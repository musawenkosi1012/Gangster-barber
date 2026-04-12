from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ...schemas.booking import BookingCreate, Booking as BookingSchema, BookingUpdate
from ...services.scheduler import scheduler
from ...db.base import get_db
from ...models import Booking, PaymentTransaction, AuditLog
import os
from datetime import date, datetime
from typing import List, Optional, Annotated

router = APIRouter()

# Type alias for cleaner code
db_dependency = Annotated[Session, Depends(get_db)]

class PaymentStatusResponse(BaseModel):
    bookingId: int
    status: str # PENDING, PAID, REJECTED, EXPIRED, ERROR
    transactionRef: Optional[str] = None
    error: Optional[dict] = None

print(f"Booking model class: {Booking}")
print(f"Booking table info: {Booking.__table__ if hasattr(Booking, '__table__') else 'No __table__'}")

@router.post("/", response_model=BookingSchema, responses={
    400: {"description": "Requested slot is not available or date is in the past"},
    409: {"description": "Double booking detected"},
    500: {"description": "Internal database error"}
})
def create_booking(req: BookingCreate, db: db_dependency):
    zims_now = scheduler.get_zimbabwe_now()
    target_date = req.booking_date or zims_now.date()
    
    # Safety Check: Prevent past dates
    if target_date < zims_now.date():
        raise HTTPException(status_code=400, detail="Cannot book sessions in the past")

    if req.slot_time:
        # Custom booking: verify availability
        if not scheduler.is_slot_available(db, req.slot_time, target_date):
             raise HTTPException(status_code=400, detail=f"Requested slot is not available for {target_date}")
        slot = req.slot_time
        booking_date = target_date
    else:
        # Automatic booking: check next 7 days
        allocation = scheduler.allocate_next_available(db)
        if not allocation:
            raise HTTPException(
                status_code=400, 
                detail="The barber is fully booked for this week. We'd love to have you next week!"
            )
        slot = allocation["time"]
        booking_date = allocation["date"]
    
    # Create the ORM model instance
    new_booking = Booking(
        name=req.name,
        service=req.service,
        user_id=req.user_id,
        slot_time=slot,
        booking_date=booking_date,
        status="PENDING" if req.payment_method != "CASH" else "CONFIRMED"
    )
    
    try:
        db.add(new_booking)
        db.flush() # Get the ID before commit
        
        # 2. Record in Audit Log
        audit = AuditLog(
            actor_id=req.user_id,
            role="customer",
            action="CREATE_BOOKING",
            resource_id=str(new_booking.id),
            metadata_json={"service": req.service, "date": str(booking_date), "slot": slot}
        )
        db.add(audit)

        db.commit()
        db.refresh(new_booking)
        return new_booking
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot was just taken by someone else. Please try another time.")
    except Exception as e:
        db.rollback()
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save booking to database")

@router.patch("/{booking_id}", response_model=BookingSchema, responses={
    400: {"description": "Slot already booked or invalid data"},
    404: {"description": "Booking not found"}
})
def update_booking(booking_id: int, req: BookingUpdate, db: db_dependency):
    db_booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_data = req.model_dump(exclude_unset=True)
    
    # If time or date is changing, verify availability
    new_date = update_data.get("booking_date", db_booking.booking_date)
    new_time = update_data.get("slot_time", db_booking.slot_time)
    
    if "booking_date" in update_data or "slot_time" in update_data:
        # Check against others (excluding self)
        conflict = db.query(Booking).filter(
            Booking.booking_date == new_date,
            Booking.slot_time == new_time,
            Booking.id != booking_id
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="The new slot is already booked")

    for key, value in update_data.items():
        setattr(db_booking, key, value)
    
    db.commit()
    db.refresh(db_booking)
    return db_booking

@router.delete("/{booking_id}", responses={
    404: {"description": "Booking not found"}
})
def delete_booking(booking_id: int, db: db_dependency):
    db_booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    db.delete(db_booking)
    db.commit()
    return {"message": "Booking cancelled successfully"}

@router.get("/slots")
def get_available_slots(db: db_dependency, date: Optional[date] = None):
    return scheduler.get_all_slots(db, date)

@router.get("/", response_model=List[BookingSchema])
def list_bookings(db: db_dependency, booking_date: Optional[date] = None):
    query = db.query(Booking)
    if booking_date:
        query = query.filter(Booking.booking_date == booking_date)
    return query.order_by(Booking.booking_date.desc()).all()

class PaymentVerification(BaseModel):
    booking_id: int
    provider_ref: str

@router.post("/verify-payment")
def submit_payment_reference(req: PaymentVerification, db: db_dependency):
    """
    Allows the customer to submit an EcoCash/OneMoney reference code.
    Flags the transaction for manual review in the IT Command Center.
    """
    transaction = db.query(PaymentTransaction).filter(
        PaymentTransaction.booking_id == req.booking_id,
        PaymentTransaction.status == "pending"
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Pending transaction not found for this booking")
    
    # Move to manual_review for IT/Admin verification
    transaction.provider_ref = req.provider_ref
    transaction.status = "manual_review"
    
    # Update booking status
    booking = db.query(Booking).filter(Booking.id == req.booking_id).first()
    if booking:
        booking.status = "VERIFYING"
    
    # Log the verification attempt
    audit = AuditLog(
        actor_id=booking.user_id if booking else "unknown",
        role="customer",
        action="SUBMIT_PAYMENT_REF",
        resource_id=str(req.booking_id),
        metadata_json={"ref": req.provider_ref}
    )
    db.add(audit)
    
    db.commit()
    return {"message": "Reference submitted. Verification in progress."}

@router.get("/user/{user_id}", response_model=List[BookingSchema])
def get_user_bookings(user_id: str, db: db_dependency):
    return db.query(Booking).filter(Booking.user_id == user_id).order_by(Booking.booking_date.desc()).all()

@router.get("/{booking_id}/payment-status", response_model=PaymentStatusResponse)
def get_payment_status(booking_id: int, db: db_dependency):
    """
    Refined Status Hub: Orchestrates the transition from PENDING to either CONFIRMED or CANCELLED
    based on the financial outcome. Fills the contract-driven intent for graceful failure.
    """
    try:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        transaction = db.query(PaymentTransaction).filter(
            PaymentTransaction.booking_id == booking_id
        ).order_by(PaymentTransaction.id.desc()).first()

        # Phase 3 IDD: Determine the absolute state
        if not transaction:
            return {
                "bookingId": booking_id,
                "status": "PENDING", # No transaction yet, usually means the user just landed on payment page
                "transactionRef": None
            }

        # Safe detection of REJECTED/CANCELLED states
        is_rejected = transaction.status in ["cancelled", "rejected", "failed"]
        
        if is_rejected:
            # Shift-Left Logic: If payment is dead, release the resource (the slot)
            if booking.status != "CANCELLED":
                booking.status = "CANCELLED"
                db.commit()
            
            return {
                "bookingId": booking_id,
                "status": "REJECTED",
                "error": {
                    "code": f"PAYMENT_{transaction.status.upper()}",
                    "message": "The payment process was not completed successfully."
                }
            }

        if transaction.status == "completed":
            # Just in case the webhook was faster than this poll
            return {
                "bookingId": booking_id,
                "status": "PAID",
                "transactionRef": transaction.provider_ref
            }

        return {
            "bookingId": booking_id,
            "status": "PENDING",
            "transactionRef": transaction.poll_url
        }

    except Exception as e:
        # GreenOps Audit: Log minimal necessary telemetry to resolve the anomaly
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.error(f"Intent Violation in Payment Status [ID:{booking_id}]: {str(e)}")
        
        return {
            "bookingId": booking_id,
            "status": "ERROR",
            "error": {"code": "TELEMETRY_FAILURE", "message": "Manual verification required."}
        }


class CompletePaymentRequest(BaseModel):
    transaction_status: str = "completed"


@router.post("/{booking_id}/confirm")
def confirm_booking(booking_id: int, request: Request, db: db_dependency):
    """
    Final Commitment Endpoint.
    Only callable by internal services (Payment Context) after verification.
    """
    secret = request.headers.get("X-Internal-Secret")
    if secret != os.getenv("INTERNAL_API_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden: Internal Clearance Only")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking.status = "CONFIRMED"
    db.commit()
    return {"status": "CONFIRMED", "booking_id": booking_id}
