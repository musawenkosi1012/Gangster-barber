"""
Bookings endpoint — Gangster Barber
────────────────────────────────────
Two-phase payment architecture:
  Phase 1  POST /api/book/            → creates booking in PENDING + 10-min TTL
  Phase 2  POST /api/book/{id}/confirm → called by PayNow webhook after verification
                                         promotes PENDING → CONFIRMED

Slot cleanup:
  POST /api/book/cleanup-expired      → cancels all PENDING rows past reserved_until
  (called by Vercel cron every 5 min)
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from ...schemas.booking import BookingCreate, Booking as BookingSchema, BookingUpdate
from ...services.scheduler import scheduler
from ...db.base import get_db
from ...models import Booking, PaymentTransaction, AuditLog
from ..deps import get_current_user
from ...crud.booking import booking_crud
from ...crud.customer import customer_crud
from ...core.limiter import limiter
from datetime import date, datetime, timedelta
from typing import List, Optional, Annotated
import os
import logging

logger = logging.getLogger("bookings")
router = APIRouter()

# ── Constants ───────────────────────────────────────────────────────────────
RESERVATION_TTL_MINUTES = 10   # How long a PENDING slot is held before auto-cancel
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "")

# Type alias for cleaner signatures
db_dependency = Annotated[Session, Depends(get_db)]


# ── Response Schemas ─────────────────────────────────────────────────────────
class PaymentStatusResponse(BaseModel):
    bookingId: int
    status: str           # PENDING | PAID | REJECTED | EXPIRED | ERROR
    transactionRef: Optional[str] = None
    error: Optional[dict] = None


class PaymentVerification(BaseModel):
    booking_id: int
    provider_ref: str


class CompletePaymentRequest(BaseModel):
    transaction_status: str = "completed"


# ── Helper ────────────────────────────────────────────────────────────────────
def _get_zim_now() -> datetime:
    """Current time in Africa/Harare (UTC+2), timezone-aware."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Africa/Harare"))
    except ImportError:
        from datetime import timezone
        return datetime.now(timezone(timedelta(hours=2)))


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/
#  Phase 1: Reserve the slot.  Booking is PENDING until the webhook fires.
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/", response_model=BookingSchema, responses={
    400: {"description": "Invalid slot, past date, or missing amount"},
    403: {"description": "Identity mismatch"},
    409: {"description": "Slot conflict"},
    500: {"description": "Database error"},
})
@router.post("", response_model=BookingSchema, include_in_schema=False)
@limiter.limit("5/minute")
def create_booking(
    req: BookingCreate,
    db: db_dependency,
    request: Request,
    user: dict = Depends(get_current_user),
) -> Booking:
    # ── Identity Guard ───────────────────────────────────────────────────
    if req.user_id != user.get("sub"):
        raise HTTPException(status_code=403, detail="CSRF Violation: Identity mismatch")

    zims_now = _get_zim_now()
    target_date = req.booking_date or zims_now.date()

    if target_date < zims_now.date():
        raise HTTPException(status_code=400, detail="Cannot book sessions in the past")

    # ── Slot allocation ──────────────────────────────────────────────────
    if req.slot_time:
        if not scheduler.is_slot_available(db, req.slot_time, target_date):
            raise HTTPException(
                status_code=400,
                detail=f"Requested slot is not available for {target_date}",
            )
        slot = req.slot_time
        booking_date = target_date
    else:
        allocation = scheduler.allocate_next_available(db)
        if not allocation:
            raise HTTPException(
                status_code=400,
                detail="The barber is fully booked for this week. We'd love to have you next week!",
            )
        slot = allocation["time"]
        booking_date = allocation["date"]

    is_cash = req.payment_method in (None, "CASH", "cash")

    # ── Payment amount guard ─────────────────────────────────────────────
    if not is_cash and (not req.payment_amount or req.payment_amount <= 0):
        raise HTTPException(
            status_code=400,
            detail="A payment amount greater than zero is required for non-cash bookings.",
        )

    # ── Build booking record ─────────────────────────────────────────────
    # Cash payments are immediately CONFIRMED (no payment needed).
    # All electronic payments start as PENDING with a 10-minute TTL so the
    # slot is held but NOT locked permanently until the webhook fires.
    ttl = zims_now + timedelta(minutes=RESERVATION_TTL_MINUTES) if not is_cash else None

    new_booking = Booking(
        name=req.name,
        service=req.service,
        user_id=req.user_id,
        slot_time=slot,
        booking_date=booking_date,
        status="CONFIRMED" if is_cash else "PENDING",
        reserved_until=ttl,
    )

    try:
        db.add(new_booking)
        db.flush()  # Materialise the ID before commit

        # ── PaymentTransaction ───────────────────────────────────────────
        # Created for every non-cash booking so the ledger, status-poll,
        # and confirm webhook all have a record to operate on.
        if not is_cash:
            transaction = PaymentTransaction(
                booking_id=new_booking.id,
                amount=req.payment_amount,
                currency="USD",
                provider=req.payment_method,
                status="pending",
                poll_url=req.poll_url,
                # BUG 2 FIX: store the paynow_ref at initiation time.
                # The frontend generates a UUID before calling /initiate and
                # passes it back here via the poll_url field metadata.
                # The actual Paynow reference code is captured from the
                # webhook (provider_ref) once payment completes.
                paynow_ref=req.paynow_ref,
                metadata_json={
                    "service": req.service,
                    "date": str(booking_date),
                    "slot": slot,
                    "initiated_by": req.user_id,
                    "reserved_until": ttl.isoformat() if ttl else None,
                },
            )
            db.add(transaction)

        # ── Audit log ────────────────────────────────────────────────────
        audit = AuditLog(
            actor_id=req.user_id,
            role="customer",
            action="CREATE_BOOKING",
            resource_id=str(new_booking.id),
            metadata_json={
                "service": req.service,
                "date": str(booking_date),
                "slot": slot,
                "payment_method": req.payment_method,
                "status": new_booking.status,
                "reserved_until": ttl.isoformat() if ttl else None,
            },
        )
        db.add(audit)

        # ── CRM sync (non-critical) ──────────────────────────────────────
        try:
            customer_crud.upsert_from_booking(db, clerk_id=req.user_id, name=req.name)
        except Exception:
            pass

        db.commit()
        db.refresh(new_booking)
        return new_booking

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This slot was just taken by someone else. Please try another time.",
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Database error creating booking: {exc}")
        raise HTTPException(status_code=500, detail="Failed to save booking to database")


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/{booking_id}/confirm
#  Phase 2: Webhook-only endpoint — promotes PENDING → CONFIRMED.
#  Called by the PayNow microservice after hash-verified IPN.
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/{booking_id}/confirm")
def confirm_booking(booking_id: int, request: Request, db: db_dependency) -> dict:
    # ── Internal secret guard ────────────────────────────────────────────
    secret = request.headers.get("X-Internal-Secret")
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: Internal Clearance Only")

    booking = booking_crud.get_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # ── Idempotency: already confirmed — return success without re-writing ─
    if booking.status == "CONFIRMED":
        logger.info(f"Booking {booking_id} already CONFIRMED — skipping duplicate confirm")
        return {"status": "CONFIRMED", "booking_id": booking_id, "idempotent": True}

    # ── Guard: TTL expired before confirmation arrived ────────────────────
    # We still confirm it — the webhook proves real payment. The TTL is only
    # for cleanup of ABANDONED reservations with no payment signal.
    zims_now = _get_zim_now()

    # Extract Paynow reference from the webhook payload header (set by paynow service)
    paynow_reference = request.headers.get("X-Paynow-Reference")

    try:
        booking.status = "CONFIRMED"
        booking.reserved_until = None  # Clear TTL — slot is permanently locked

        transaction = booking_crud.get_latest_transaction(db, booking_id)
        if transaction:
            transaction.status = "completed"
            # BUG 2 FIX: store the authoritative reference from the IPN
            if paynow_reference:
                transaction.provider_ref = paynow_reference

        audit = AuditLog(
            actor_id=booking.user_id,
            role="system",
            action="PAYMENT_CONFIRMED",
            resource_id=str(booking_id),
            metadata_json={
                "provider": transaction.provider if transaction else None,
                "amount": transaction.amount if transaction else None,
                "provider_ref": paynow_reference,
                "confirmed_at": zims_now.isoformat(),
            },
        )
        db.add(audit)
        db.commit()
        return {"status": "CONFIRMED", "booking_id": booking_id}

    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Confirm commit failed for booking {booking_id}: {exc}")
        raise HTTPException(status_code=500, detail="Final commitment state transition failed")


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/{booking_id}/cancel
#  Called by the PayNow microservice when the IPN reports a cancelled or
#  failed payment.  Transitions:
#    PaymentTransaction.status  → "failed"
#    Booking.status             → "CANCELLED"
#  Idempotent — safe to call multiple times.
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/{booking_id}/cancel")
def cancel_booking_payment(
    booking_id: int,
    request: Request,
    db: db_dependency,
) -> dict:
    secret = request.headers.get("X-Internal-Secret")
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: Internal Clearance Only")

    booking = booking_crud.get_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Idempotency — already cancelled, nothing to do
    if booking.status == "CANCELLED":
        logger.info(f"Booking {booking_id} already CANCELLED — skipping duplicate cancel")
        return {"status": "CANCELLED", "booking_id": booking_id, "idempotent": True}

    # Only cancel PENDING bookings — never cancel CONFIRMED or VERIFYING ones
    if booking.status not in ("PENDING", "VERIFYING"):
        logger.warning(f"Cancel rejected for booking {booking_id}: status is {booking.status}")
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel a booking in status {booking.status}"
        )

    try:
        booking.status = "CANCELLED"
        booking.reserved_until = None  # Clear TTL — no longer needed

        transaction = booking_crud.get_latest_transaction(db, booking_id)
        if transaction and transaction.status in ("pending", "manual_review"):
            transaction.status = "failed"

        audit = AuditLog(
            actor_id=booking.user_id,
            role="system",
            action="PAYMENT_CANCELLED",
            resource_id=str(booking_id),
            metadata_json={
                "previous_status": booking.status,
                "reason": "PayNow IPN reported cancelled/failed",
                "cancelled_at": _get_zim_now().isoformat(),
            },
        )
        db.add(audit)
        db.commit()
        logger.info(f"Booking {booking_id} cancelled — slot released")
        return {"status": "CANCELLED", "booking_id": booking_id}

    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Cancel commit failed for booking {booking_id}: {exc}")
        raise HTTPException(status_code=500, detail="Cancel state transition failed")


# ═══════════════════════════════════════════════════════════════════════════
#  GET|POST /api/book/cleanup-expired
#  Vercel cron calls this every 5 minutes to release stuck PENDING slots.
#  GET  → used by Vercel cron (crons only support GET).
#  POST → used by internal services / manual admin trigger.
#  Both are protected by the X-Internal-Secret header.
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/cleanup-expired")
@router.post("/cleanup-expired")
def cleanup_expired_reservations(request: Request, db: db_dependency) -> dict:
    secret = request.headers.get("X-Internal-Secret")
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        result = db.execute(
            text(
                """
                UPDATE public.bookings
                SET status = 'CANCELLED'
                WHERE status = 'PENDING'
                  AND reserved_until IS NOT NULL
                  AND reserved_until < NOW()
                RETURNING id
                """
            )
        )
        cancelled_ids = [row[0] for row in result.fetchall()]

        if cancelled_ids:
            # Mark corresponding transactions as failed
            db.execute(
                text(
                    """
                    UPDATE public.payment_transactions
                    SET status = 'failed'
                    WHERE booking_id = ANY(:ids)
                      AND status = 'pending'
                    """
                ),
                {"ids": cancelled_ids},
            )

        db.commit()
        logger.info(f"Cleanup: cancelled {len(cancelled_ids)} expired reservations → IDs: {cancelled_ids}")
        return {"cancelled": len(cancelled_ids), "ids": cancelled_ids}

    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Cleanup job failed: {exc}")
        raise HTTPException(status_code=500, detail="Cleanup failed")


# ═══════════════════════════════════════════════════════════════════════════
#  GET /api/book/{booking_id}/payment-status
#  Frontend polls this every 4s during the awaiting_payment state.
#  Status is written by the PayNow webhook → confirm endpoint, not by polling.
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/{booking_id}/payment-status", response_model=PaymentStatusResponse)
def get_payment_status(
    booking_id: int,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        booking = booking_crud.get_by_id(db, booking_id)
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        is_admin = user.get("metadata", {}).get("role") in ["admin", "owner"]
        if booking.user_id != user.get("sub") and not is_admin:
            raise HTTPException(status_code=403, detail="Forbidden: You do not own this booking")

        transaction = booking_crud.get_latest_transaction(db, booking_id)

        if not transaction:
            return {"bookingId": booking_id, "status": "PENDING", "transactionRef": None}

        # ── Confirmed (webhook already fired) ───────────────────────────
        if transaction.status == "completed" or booking.status == "CONFIRMED":
            return {
                "bookingId": booking_id,
                "status": "PAID",
                "transactionRef": transaction.provider_ref or transaction.paynow_ref,
            }

        # ── Payment failed / cancelled ───────────────────────────────────
        if transaction.status in ("cancelled", "rejected", "failed"):
            if booking.status != "CANCELLED":
                booking.status = "CANCELLED"
                try:
                    db.commit()
                except Exception:
                    db.rollback()
            return {
                "bookingId": booking_id,
                "status": "REJECTED",
                "error": {
                    "code": f"PAYMENT_{transaction.status.upper()}",
                    "message": "The payment was not completed successfully.",
                },
            }

        # ── TTL expired — abandon the reservation ────────────────────────
        zims_now = _get_zim_now()
        if (
            booking.reserved_until
            and booking.reserved_until.replace(tzinfo=None) < zims_now.replace(tzinfo=None)
            and booking.status == "PENDING"
        ):
            booking.status = "CANCELLED"
            if transaction:
                transaction.status = "failed"
            try:
                db.commit()
            except Exception:
                db.rollback()
            return {
                "bookingId": booking_id,
                "status": "EXPIRED",
                "error": {
                    "code": "RESERVATION_TTL_EXCEEDED",
                    "message": "Payment window expired. Please book again.",
                },
            }

        # ── Still pending: actively check PayNow poll_url as IPN fallback ──
        # The IPN webhook is the primary signal. On every poll call we also
        # query PayNow directly so a cancelled or paid status is captured
        # immediately without waiting for the IPN or the TTL to expire.
        if transaction.poll_url:
            try:
                import httpx as _httpx
                paynow_svc = os.getenv("PAYNOW_SERVICE_URL", "")
                if paynow_svc:
                    with _httpx.Client(timeout=8.0) as client:
                        pn_resp = client.get(
                            f"{paynow_svc}/api/payments/check-status",
                            params={"poll_url": transaction.poll_url},
                        )
                    if pn_resp.status_code == 200:
                        pn_status = (pn_resp.json().get("status") or "").lower()
                        if pn_status in ("paid", "awaiting delivery", "delivered"):
                            booking.status = "CONFIRMED"
                            transaction.status = "completed"
                            booking.reserved_until = None
                            try:
                                db.commit()
                            except Exception:
                                db.rollback()
                            return {
                                "bookingId": booking_id,
                                "status": "PAID",
                                "transactionRef": transaction.provider_ref or transaction.paynow_ref,
                            }
                        elif pn_status in ("cancelled", "failed"):
                            booking.status = "CANCELLED"
                            transaction.status = "failed"
                            booking.reserved_until = None
                            try:
                                db.commit()
                            except Exception:
                                db.rollback()
                            return {
                                "bookingId": booking_id,
                                "status": "REJECTED",
                                "error": {
                                    "code": "PAYMENT_CANCELLED",
                                    "message": "Payment was cancelled or rejected.",
                                },
                            }
            except Exception as poll_exc:
                logger.warning(f"PayNow active poll failed for booking {booking_id}: {poll_exc}")

        return {
            "bookingId": booking_id,
            "status": "PENDING",
            "transactionRef": transaction.poll_url,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Payment status check failed [booking={booking_id}]: {exc}")
        return {
            "bookingId": booking_id,
            "status": "ERROR",
            "error": {"code": "STATUS_CHECK_FAILED", "message": "Manual verification required."},
        }


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/verify-payment   (fallback manual reference submission)
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/verify-payment")
def submit_payment_reference(
    req: PaymentVerification,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Customer manually submits an EcoCash/OneMoney reference code.
    Flags the transaction for manual review in the IT Command Center.
    This is the fallback path — the primary path is the PayNow webhook.
    """
    booking = booking_crud.get_by_id(db, req.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.get("sub"):
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this booking")

    transaction = booking_crud.get_pending_transaction(db, req.booking_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Pending transaction not found for this booking")

    transaction.provider_ref = req.provider_ref
    transaction.status = "manual_review"
    booking.status = "VERIFYING"
    # Clear TTL so the slot isn't auto-cancelled while under manual review
    booking.reserved_until = None

    audit = AuditLog(
        actor_id=booking.user_id,
        role="customer",
        action="SUBMIT_PAYMENT_REF",
        resource_id=str(req.booking_id),
        metadata_json={"ref": req.provider_ref},
    )
    try:
        db.add(audit)
        db.commit()
        return {"message": "Reference submitted. Our team will verify and confirm your booking shortly."}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Reference submission failed")


# ═══════════════════════════════════════════════════════════════════════════
#  Standard CRUD
# ═══════════════════════════════════════════════════════════════════════════
@router.patch("/{booking_id}", response_model=BookingSchema)
def update_booking(
    booking_id: int,
    req: BookingUpdate,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> Booking:
    db_booking = booking_crud.get_by_id(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if db_booking.user_id != user.get("sub") and user.get("metadata", {}).get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Forbidden: Resource ownership mismatch")

    update_data = req.model_dump(exclude_unset=True)
    new_date = update_data.get("booking_date", db_booking.booking_date)
    new_time = update_data.get("slot_time", db_booking.slot_time)

    if "booking_date" in update_data or "slot_time" in update_data:
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
        raise HTTPException(status_code=500, detail="Update commit failed")


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> dict:
    db_booking = booking_crud.get_by_id(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if db_booking.user_id != user.get("sub") and user.get("metadata", {}).get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Resource protection violation")

    try:
        db.delete(db_booking)
        db.commit()
        return {"message": "Booking cancelled successfully"}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Cancellation failed")


@router.get("/slots")
def get_available_slots(db: db_dependency, date: Optional[date] = None) -> List[dict]:
    return scheduler.get_all_slots(db, date)


@router.get("/", response_model=List[BookingSchema])
def list_bookings(
    db: db_dependency,
    booking_date: Optional[date] = None,
) -> List[Booking]:
    if booking_date:
        return booking_crud.list_by_date(db, str(booking_date))
    return db.query(Booking).order_by(Booking.booking_date.desc()).all()


@router.get("/user/{user_id}", response_model=List[BookingSchema])
def get_user_bookings(
    user_id: str,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> List[Booking]:
    if user_id != user.get("sub") and user.get("metadata", {}).get("role") not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Personal data isolation violation")
    return booking_crud.list_by_user(db, user_id)
