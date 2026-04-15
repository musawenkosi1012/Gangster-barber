from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from ...schemas.booking import BookingCreate, Booking as BookingSchema, BookingUpdate
from ...services.scheduler import scheduler
from ...db.base import get_db
from ...models import Booking, PaymentTransaction, AuditLog
from ...models.operational import Service
from ..deps import get_current_user
from ...crud.booking import booking_crud
from ...crud.customer import customer_crud
from ...core.limiter import limiter
from datetime import date, datetime
from typing import List, Optional, Annotated
import os

router = APIRouter()

# Type alias for cleaner code
db_dependency = Annotated[Session, Depends(get_db)]

class PaymentStatusResponse(BaseModel):
    bookingId: int
    status: str # PENDING, PAID, REJECTED, EXPIRED, ERROR
    transactionRef: Optional[str] = None
    error: Optional[dict] = None



@router.post("/", response_model=BookingSchema, responses={
    400: {"description": "Requested slot is not available or date is in the past"},
    409: {"description": "Double booking detected"},
    500: {"description": "Internal database error"}
})
@router.post("", response_model=BookingSchema, include_in_schema=False)
@limiter.limit("5/minute")
def create_booking(req: BookingCreate, db: db_dependency, request: Request, user: dict = Depends(get_current_user)) -> Booking:
    # Identity Guard: Ensure user can only book for themselves
    if req.user_id != user.get("sub"):
        raise HTTPException(status_code=403, detail="CSRF Violation: Identity mismatch")
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
    
    is_cash = req.payment_method in (None, "CASH", "cash")

    # CRIT-1: Server-side price enforcement — look up the canonical booking_fee from
    # the services table and use that as the authoritative charge amount.
    # Clients can no longer inject arbitrary prices; the server always dictates the amount.
    canonical_amount: float = 0.0
    if not is_cash:
        service_record = db.query(Service).filter(
            Service.name.ilike(req.service),
            Service.is_active == True
        ).first()

        if not service_record:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown or inactive service: '{req.service}'. Cannot determine price."
            )

        # booking_fee is the deposit amount; fall back to full service price if not set
        canonical_amount = service_record.booking_fee or service_record.price or 0.0

        if canonical_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="Service has no configured price. Contact support."
            )

    # CRIT-2: Zero-dollar guard — non-cash bookings must have a positive amount.
    # Python treats 0.0 as falsy, so `if req.payment_amount` alone silently skips
    # PaymentTransaction creation, leaving a PENDING slot reserved at zero cost.
    if not is_cash:
        if not req.payment_amount or req.payment_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="A payment amount greater than zero is required for non-cash bookings."
            )

    # Create the ORM model instance
    new_booking = Booking(
        name=req.name,
        service=req.service,
        user_id=req.user_id,
        slot_time=slot,
        booking_date=booking_date,
        status="CONFIRMED" if is_cash else "PENDING"
    )

    try:
        db.add(new_booking)
        db.flush() # Get the ID before commit

        # Create PaymentTransaction for all non-cash bookings so the ledger,
        # payment-status poll, and confirm webhook all have a record to work with.
        # CRIT-1: Use canonical_amount (server-side validated price) — never trust req.payment_amount
        if not is_cash and canonical_amount:
            transaction = PaymentTransaction(
                booking_id=new_booking.id,
                amount=canonical_amount,
                currency="USD",
                provider=req.payment_method,
                status="pending",
                poll_url=req.poll_url,
                metadata_json={
                    "service": req.service,
                    "date": str(booking_date),
                    "slot": slot,
                    "initiated_by": req.user_id,
                }
            )
            db.add(transaction)

        # Record in Audit Log
        audit = AuditLog(
            actor_id=req.user_id,
            role="customer",
            action="CREATE_BOOKING",
            resource_id=str(new_booking.id),
            metadata_json={"service": req.service, "date": str(booking_date), "slot": slot, "payment_method": req.payment_method}
        )
        db.add(audit)

        # CRM Sync: Upsert customer record so the admin CRM is always populated
        try:
            customer_crud.upsert_from_booking(db, clerk_id=req.user_id, name=req.name)
        except Exception:
            pass  # Non-critical — never fail a booking because of CRM sync

        try:
            db.commit()
            db.refresh(new_booking)
        except Exception:
            db.rollback()
            raise
        return new_booking
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot was just taken by someone else. Please try another time.")
    except SQLAlchemyError as e:
        db.rollback()
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save booking to database")

@router.patch("/{booking_id}", response_model=BookingSchema, responses={
    400: {"description": "Slot already booked or invalid data"},
    404: {"description": "Booking not found"}
})
def update_booking(booking_id: int, req: BookingUpdate, db: db_dependency, user: dict = Depends(get_current_user)) -> Booking:
    db_booking = booking_crud.get_by_id(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Ownership Shield: Prevent unauthorized mutations
    if db_booking.user_id != user.get("sub") and user.get("metadata", {}).get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Forbidden: Resource ownership mismatch")
    
    update_data = req.model_dump(exclude_unset=True)
    
    # If time or date is changing, verify availability
    new_date = update_data.get("booking_date", db_booking.booking_date)
    new_time = update_data.get("slot_time", db_booking.slot_time)
    
    if "booking_date" in update_data or "slot_time" in update_data:
        # Check against others (excluding self)
        if booking_crud.check_conflict(db, new_date, new_time, exclude_id=booking_id):
            raise HTTPException(status_code=400, detail="The new slot is already booked")

    for key, value in update_data.items():
        setattr(db_booking, key, value)
    
    try:
        db.commit()
        db.refresh(db_booking)
        return db_booking
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Safe-Commit Failure: Logic state inconsistent")

@router.delete("/{booking_id}", responses={
    404: {"description": "Booking not found"}
})
def delete_booking(booking_id: int, db: db_dependency, user: dict = Depends(get_current_user)) -> dict:
    db_booking = booking_crud.get_by_id(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Ownership Shield
    if db_booking.user_id != user.get("sub") and user.get("metadata", {}).get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Resource protection violation")

    try:
        db.delete(db_booking)
        db.commit()
        return {"message": "Booking cancelled successfully"}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Decommissioning failed")

@router.get("/slots")
def get_available_slots(db: db_dependency, date: Optional[date] = None) -> List[dict]:
    return scheduler.get_all_slots(db, date)

@router.get("/", response_model=List[BookingSchema])
def list_bookings(db: db_dependency, booking_date: Optional[date] = None) -> List[Booking]:
    if booking_date:
        return booking_crud.list_by_date(db, str(booking_date))
    return db.query(Booking).order_by(Booking.booking_date.desc()).all()

class PaymentVerification(BaseModel):
    booking_id: int
    provider_ref: str

@router.post("/verify-payment")
def submit_payment_reference(req: PaymentVerification, db: db_dependency, user: dict = Depends(get_current_user)) -> dict:
    """
    Allows the customer to submit an EcoCash/OneMoney reference code.
    Flags the transaction for manual review in the IT Command Center.
    """
    # CRIT-5: Ownership check — verify the caller owns this booking before
    # accepting a payment reference. Prevents anonymous actors from injecting
    # fake references against other users' bookings.
    booking = booking_crud.get_by_id(db, req.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.get("sub"):
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this booking")

    transaction = booking_crud.get_pending_transaction(db, req.booking_id)

    if not transaction:
        raise HTTPException(status_code=404, detail="Pending transaction not found for this booking")

    # Move to manual_review for IT/Admin verification
    transaction.provider_ref = req.provider_ref
    transaction.status = "manual_review"
    
    # Update booking status
    booking = booking_crud.get_by_id(db, req.booking_id)
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
    try:
        db.add(audit)
        db.commit()
        return {"message": "Reference submitted. Verification in progress."}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Financial registry update failed")

@router.get("/user/{user_id}", response_model=List[BookingSchema])
def get_user_bookings(user_id: str, db: db_dependency, user: dict = Depends(get_current_user)) -> List[Booking]:
    # Privacy Guard
    if user_id != user.get("sub") and user.get("metadata", {}).get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Personal data isolation violation")
    return booking_crud.list_by_user(db, user_id)

@router.get("/{booking_id}/payment-status", response_model=PaymentStatusResponse)
def get_payment_status(booking_id: int, db: db_dependency, user: dict = Depends(get_current_user)) -> dict:
    """
    Refined Status Hub: Orchestrates the transition from PENDING to either CONFIRMED or CANCELLED
    based on the financial outcome. Fills the contract-driven intent for graceful failure.
    """
    try:
        booking = booking_crud.get_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        # CRIT-4: Ownership check — only the booking owner or admin/owner can poll payment status.
        is_admin = user.get("metadata", {}).get("role") in ["admin", "owner"]
        if booking.user_id != user.get("sub") and not is_admin:
            raise HTTPException(status_code=403, detail="Forbidden: You do not own this booking")

        transaction = booking_crud.get_latest_transaction(db, booking_id)

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
                try:
                    db.commit()
                except Exception:
                    db.rollback()
                    raise
            
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
def confirm_booking(booking_id: int, request: Request, db: db_dependency) -> dict:
    """
    Final Commitment Endpoint.
    Only callable by internal services (Payment Context) after verification.
    """
    secret = request.headers.get("X-Internal-Secret")
    if secret != os.getenv("INTERNAL_API_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden: Internal Clearance Only")

    booking = booking_crud.get_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    try:
        booking.status = "CONFIRMED"

        # Update the PaymentTransaction so the ledger reflects the completed payment
        transaction = booking_crud.get_latest_transaction(db, booking_id)
        if transaction:
            transaction.status = "completed"

        # Audit the confirmation
        audit = AuditLog(
            actor_id=booking.user_id,
            role="system",
            action="PAYMENT_CONFIRMED",
            resource_id=str(booking_id),
            metadata_json={
                "provider": transaction.provider if transaction else None,
                "amount": transaction.amount if transaction else None,
                "provider_ref": transaction.provider_ref if transaction else None,
            }
        )
        db.add(audit)

        db.commit()
        return {"status": "CONFIRMED", "booking_id": booking_id}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Final commitment state transition failed")
