"""
Bookings endpoint — Gangster Barber
────────────────────────────────────
Draft-in-cache architecture (v2):

  Phase 1  POST /api/book/
           ─ Validates slot availability
           ─ Returns a signed DRAFT TOKEN (JWT, 10-min TTL)
           ─ NO database write at this point

  Phase 2  POST /api/payments/initiate  (PayNow microservice)
           ─ Receives draft_token in request payload
           ─ Passes it through to PayNow as opaque metadata

  Phase 3  POST /api/book/confirm
           ─ Called ONLY by the verified PayNow webhook
           ─ Decodes the draft token
           ─ Creates the Booking row as CONFIRMED in one atomic write
           ─ Creates the PaymentTransaction as completed

  Phase 4  POST /api/book/{id}/cancel
           ─ Called by the webhook on payment failure
           ─ Sets booking CANCELLED + transaction failed (idempotent)

Slot cleanup:
  No periodic cleanup job needed — PENDING rows no longer exist.
  Slot availability is computed from CONFIRMED + COMPLETED only.
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
from ...models.operational import Service
from ..deps import get_current_user
from ...crud.booking import booking_crud
from ...crud.customer import customer_crud
from ...crud.drafts import draft_crud
from ...core.limiter import limiter
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional, Annotated
import os
import logging
import json
import hmac
import hashlib
import base64

logger = logging.getLogger("bookings")
router = APIRouter()

# ── Constants ────────────────────────────────────────────────────────────────
DRAFT_TTL_MINUTES = 10
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "")

# Signing secret for draft tokens — falls back to INTERNAL_SECRET so no new env var needed
DRAFT_SIGNING_KEY = os.getenv("DRAFT_SIGNING_KEY", INTERNAL_SECRET or "gangster-barber-draft-key")

db_dependency = Annotated[Session, Depends(get_db)]


# ── Response Schemas ─────────────────────────────────────────────────────────
class DraftTokenResponse(BaseModel):
    """Returned from POST /api/book/ — no booking in DB yet."""
    draft_token: str          # Signed JWT carrying all booking fields
    slot_time: str
    booking_date: str
    expires_at: str           # ISO timestamp — frontend shows countdown


class PaymentStatusResponse(BaseModel):
    bookingId: Optional[int] = None
    draftToken: Optional[str] = None
    status: str               # PENDING | PAID | REJECTED | EXPIRED | ERROR
    transactionRef: Optional[str] = None
    error: Optional[dict] = None


class PaymentVerification(BaseModel):
    booking_id: int
    provider_ref: str


# ── Draft Token Helpers ───────────────────────────────────────────────────────

def _sign(payload: dict) -> str:
    """
    Produce a simple signed token: base64(payload_json).base64(hmac_sha256).
    Not a full JWT library call — avoids dependency on python-jose for this
    lightweight internal use case. Still cryptographically authenticated.
    """
    body = base64.urlsafe_b64encode(
        json.dumps(payload, default=str).encode()
    ).rstrip(b"=").decode()

    sig = hmac.new(
        DRAFT_SIGNING_KEY.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()

    return f"{body}.{sig}"


def _verify(token: str) -> dict:
    """
    Verify and decode a draft token. Raises ValueError on tampering or expiry.
    """
    try:
        body, sig = token.rsplit(".", 1)
    except ValueError:
        raise ValueError("Malformed draft token")

    expected_sig = hmac.new(
        DRAFT_SIGNING_KEY.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(sig, expected_sig):
        raise ValueError("Draft token signature invalid — possible tampering")

    # Restore missing padding
    padded = body + "=" * (-len(body) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded))

    expires_at = datetime.fromisoformat(payload["expires_at"])
    if datetime.utcnow() > expires_at:
        raise ValueError("Draft token expired")

    return payload


# ── Helper ────────────────────────────────────────────────────────────────────
def _get_zim_now() -> datetime:
    """Current time in Africa/Harare (UTC+2)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Africa/Harare"))
    except ImportError:
        from datetime import timezone
        return datetime.now(timezone(timedelta(hours=2)))


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/
#  Phase 1: Validate slot and issue a DRAFT TOKEN.
#  ─ NO database write happens here.
#  ─ The frontend holds this token in sessionStorage.
#  ─ The barber NEVER sees this booking until payment is confirmed.
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/", response_model=DraftTokenResponse, responses={
    400: {"description": "Invalid slot, past date, or missing amount"},
    403: {"description": "Identity mismatch"},
    409: {"description": "Slot conflict — slot already CONFIRMED by another customer"},
    500: {"description": "Internal error"},
})
@router.post("", response_model=DraftTokenResponse, include_in_schema=False)
@limiter.limit("5/minute")
def create_draft(
    req: BookingCreate,
    db: db_dependency,
    request: Request,
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Validates the requested slot and returns a signed draft token.
    The booking is NOT written to the database at this stage.
    The barber dashboard will only show this booking AFTER PayNow confirms payment.
    """
    # ── Identity Guard ───────────────────────────────────────────────────
    if req.user_id != user.get("sub"):
        raise HTTPException(status_code=403, detail="CSRF Violation: Identity mismatch")

    zims_now = _get_zim_now()
    target_date = req.booking_date or zims_now.date()

    if target_date < zims_now.date():
        raise HTTPException(status_code=400, detail="Cannot book sessions in the past")

    is_cash = req.payment_method in (None, "CASH", "cash")

    if not is_cash and (not req.payment_amount or req.payment_amount <= 0):
        raise HTTPException(
            status_code=400,
            detail="A payment amount greater than zero is required for non-cash bookings.",
        )

    # ── Server-side price verification ───────────────────────────────────
    # Reject requests where the client-submitted amount is below the actual
    # service price stored in the DB. This prevents a user from sending
    # payment_amount=0.01, paying $0.01 via PayNow, and getting a CONFIRMED
    # booking for a $10+ service.
    expected_amount: Optional[float] = None
    if not is_cash:
        svc = (
            db.query(Service)
            .filter(
                Service.is_active == True,
                Service.name.ilike(req.service),
            )
            .first()
        )
        if svc:
            expected_amount = round(svc.price + (svc.booking_fee or 0.0), 2)
            if req.payment_amount < expected_amount * 0.99:  # 1% float tolerance
                logger.warning(
                    f"Underpayment attempt: service={req.service!r} "
                    f"expected={expected_amount} submitted={req.payment_amount} "
                    f"user={req.user_id}"
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Payment amount ${req.payment_amount:.2f} is below the service price "
                           f"of ${expected_amount:.2f}. Please refresh the page and try again.",
                )
        else:
            # Service not found in DB — log but allow (may be a custom/cash-add
            # service not yet catalogued). We'll still verify at confirm time.
            logger.warning(f"Service {req.service!r} not found in DB — skipping price validation")

    # ── Slot validation ──────────────────────────────────────────────────
    # We check availability against CONFIRMED + COMPLETED bookings only.
    # The scheduler._is_active() already ignores PENDING/CANCELLED rows.
    if req.slot_time:
        if not scheduler.is_slot_available(db, req.slot_time, target_date):
            raise HTTPException(
                status_code=409,
                detail=f"Slot {req.slot_time} on {target_date} is already taken.",
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

    # ── Cash bookings: write directly to DB as CONFIRMED ─────────────────
    # Cash requires no payment gateway, so we skip the draft-token flow.
    if is_cash:
        return _create_confirmed_booking(
            db=db,
            req=req,
            slot=slot,
            booking_date=booking_date,
            zims_now=zims_now,
            paynow_reference=None,
        )

    # ── Electronic payment: issue draft token ────────────────────────────
    expires_at = datetime.utcnow() + timedelta(minutes=DRAFT_TTL_MINUTES)

    draft_payload = {
        "user_id":         req.user_id,
        "name":            req.name,
        "service":         req.service,
        "slot_time":       slot,
        "booking_date":    str(booking_date),
        "payment_method":  req.payment_method,
        # Use the DB-authoritative price — never trust the client-submitted value
        # for the amount that gets committed to the PaymentTransaction row.
        "payment_amount":  expected_amount if expected_amount is not None else req.payment_amount,
        "expected_amount": expected_amount,   # verified at webhook confirm time
        "paynow_ref":      req.paynow_ref,
        "expires_at":      expires_at.isoformat(),
    }

    token = _sign(draft_payload)

    # ── Persist draft in DB (survives Vercel cold starts) ────────────────
    # This replaces the old in-process _draft_store dict in the paynow
    # microservice, which lost drafts whenever /initiate and the webhook
    # landed on different Lambda instances (i.e. almost always).
    #
    # The paynow_ref UUID is generated on the frontend and round-trips
    # through PayNow as the transaction `Reference` field — so the webhook
    # can look the draft right back up by the same key.
    if not req.paynow_ref:
        raise HTTPException(
            status_code=400,
            detail="paynow_ref (client-generated UUID) is required for electronic payments",
        )

    try:
        draft_crud.store(
            db,
            paynow_ref=req.paynow_ref,
            draft_token=token,
            expires_at=expires_at.replace(tzinfo=timezone.utc),
        )
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Failed to persist draft for paynow_ref={req.paynow_ref}: {exc}")
        raise HTTPException(status_code=500, detail="Could not stage booking. Please try again.")

    logger.info(
        f"Draft persisted for paynow_ref={req.paynow_ref} — slot {slot} on {booking_date} "
        f"(expires {expires_at.isoformat()}). No Booking row yet."
    )

    return {
        "draft_token":  token,
        "slot_time":    slot,
        "booking_date": str(booking_date),
        "expires_at":   expires_at.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/confirm
#  Phase 3: Webhook-only. Decodes draft token → creates CONFIRMED booking.
#  Called by the PayNow microservice after hash-verified IPN.
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/confirm")
def confirm_from_draft(request: Request, db: db_dependency) -> dict:
    """
    Receives the draft token from the PayNow webhook and atomically:
      1. Decodes + verifies the signed draft
      2. Creates the Booking row as CONFIRMED
      3. Creates the PaymentTransaction as completed
    This is the ONLY place a booking row is written for electronic payments.
    """
    secret = request.headers.get("X-Internal-Secret")
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: Internal Clearance Only")

    # Inputs from the paynow webhook:
    #   X-Paynow-Ref       — the UUID we put in the PayNow Reference field
    #                        (primary key into payment_drafts)
    #   X-Paynow-Reference — PayNow's own transaction reference (optional,
    #                        stored for display/reconciliation)
    #   X-Payment-Amount   — the amount PayNow reports as actually paid (IPN
    #                        field). Verified against the draft's expected_amount.
    #   X-Draft-Token      — legacy path: token carried in-band rather than
    #                        looked up. Preserved only for the transitional
    #                        release so in-flight webhooks keep working.
    paynow_ref = request.headers.get("X-Paynow-Ref")
    paynow_reference = request.headers.get("X-Paynow-Reference")
    ipn_amount_header = request.headers.get("X-Payment-Amount")
    draft_token_header = request.headers.get("X-Draft-Token")

    draft_token: Optional[str] = None

    if paynow_ref:
        # Preferred path: atomically consume the draft row.
        # Returns None if the draft is missing, already consumed, or expired —
        # each case mapped to a distinct response below.
        consumed = draft_crud.consume(db, paynow_ref)

        if not consumed:
            # Disambiguate the three failure modes so the webhook can react
            # appropriately (duplicate vs forged vs too-late).
            existing = draft_crud.peek(db, paynow_ref)

            if existing and existing.consumed_at is not None:
                # Duplicate webhook for an already-confirmed booking.
                # Report success so PayNow stops retrying.
                logger.info(
                    f"Idempotent confirm — draft {paynow_ref} already consumed "
                    f"at {existing.consumed_at.isoformat()}"
                )
                # Best-effort: fetch the booking id that was created
                existing_tx = (
                    db.query(PaymentTransaction)
                    .filter(PaymentTransaction.paynow_ref == paynow_ref)
                    .first()
                )
                return {
                    "status": "CONFIRMED",
                    "booking_id": existing_tx.booking_id if existing_tx else None,
                    "idempotent": True,
                }

            if existing and existing.expires_at and existing.expires_at < datetime.now(timezone.utc):
                logger.warning(
                    f"Draft {paynow_ref} expired at {existing.expires_at.isoformat()} "
                    f"— payment arrived too late"
                )
                raise HTTPException(status_code=410, detail="Draft expired before webhook arrived")

            logger.warning(
                f"Webhook referenced unknown draft {paynow_ref} — "
                f"possible forgery or already-purged expired draft"
            )
            raise HTTPException(status_code=404, detail="Draft not found")

        draft_token = consumed.draft_token

    elif draft_token_header:
        # Legacy in-band token path. Retained for one release to bridge
        # any webhooks already queued against the old paynow service.
        logger.info("Legacy X-Draft-Token path used (transitional)")
        draft_token = draft_token_header
    else:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Paynow-Ref header (or legacy X-Draft-Token)",
        )

    # ── Decode + verify draft ────────────────────────────────────────────
    try:
        draft = _verify(draft_token)
    except ValueError as e:
        logger.warning(f"Draft token rejection: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    zims_now = _get_zim_now()
    booking_date = date.fromisoformat(draft["booking_date"])

    # ── IPN amount verification ──────────────────────────────────────────
    # The paynow service forwards the `amount` field from the IPN notification.
    # If the draft carries an expected_amount (set from the DB service price),
    # we refuse to confirm a booking where PayNow reports a lower amount —
    # catching any case where someone paid less than the service price.
    expected_amount = draft.get("expected_amount")
    if expected_amount and ipn_amount_header:
        try:
            ipn_amount = float(ipn_amount_header)
            if ipn_amount < expected_amount * 0.99:   # 1% float tolerance
                logger.error(
                    f"UNDERPAYMENT DETECTED — paynow_ref={paynow_ref} "
                    f"expected={expected_amount} ipn_paid={ipn_amount} "
                    f"service={draft.get('service')!r} user={draft.get('user_id')!r}"
                )
                raise HTTPException(
                    status_code=402,
                    detail=f"IPN amount ${ipn_amount:.2f} is below expected "
                           f"${expected_amount:.2f}. Booking not created.",
                )
        except ValueError:
            logger.warning(f"Non-numeric X-Payment-Amount header: {ipn_amount_header!r} — skipping amount check")

    # ── Idempotency: check if this draft was already confirmed ────────────
    # Use paynow_ref as the dedupe key — same IPN arriving twice should not
    # create a duplicate booking.
    paynow_ref = draft.get("paynow_ref")
    if paynow_ref:
        existing_tx = (
            db.query(PaymentTransaction)
            .filter(PaymentTransaction.paynow_ref == paynow_ref)
            .first()
        )
        if existing_tx and existing_tx.status == "completed":
            existing_booking = booking_crud.get_by_id(db, existing_tx.booking_id)
            logger.info(f"Idempotent confirm — draft {paynow_ref} already confirmed as booking {existing_tx.booking_id}")
            return {
                "status": "CONFIRMED",
                "booking_id": existing_tx.booking_id,
                "idempotent": True,
            }

    # ── Create booking as CONFIRMED ──────────────────────────────────────
    result = _create_confirmed_booking(
        db=db,
        req=None,
        slot=draft["slot_time"],
        booking_date=booking_date,
        zims_now=zims_now,
        paynow_reference=paynow_reference,
        draft=draft,
        payment_amount=draft.get("payment_amount"),
        payment_method=draft.get("payment_method"),
        paynow_ref=paynow_ref,
    )

    booking_id = result["id"]
    logger.info(f"Booking {booking_id} CONFIRMED via webhook — slot {draft['slot_time']} on {draft['booking_date']}")

    return {"status": "CONFIRMED", "booking_id": booking_id}


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/{booking_id}/confirm  (legacy — for existing DB bookings)
#  Kept for backward compatibility with any in-flight PENDING bookings.
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/{booking_id}/confirm")
def confirm_booking_legacy(booking_id: int, request: Request, db: db_dependency) -> dict:
    """
    Legacy path: promotes an existing PENDING booking row to CONFIRMED.
    Only used for bookings created before the draft-token architecture was deployed.
    New bookings use POST /api/book/confirm (no booking_id).
    """
    secret = request.headers.get("X-Internal-Secret")
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: Internal Clearance Only")

    booking = booking_crud.get_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == "CONFIRMED":
        logger.info(f"Booking {booking_id} already CONFIRMED — idempotent")
        return {"status": "CONFIRMED", "booking_id": booking_id, "idempotent": True}

    paynow_reference = request.headers.get("X-Paynow-Reference")
    zims_now = _get_zim_now()

    try:
        booking.status = "CONFIRMED"
        booking.reserved_until = None

        transaction = booking_crud.get_latest_transaction(db, booking_id)
        if transaction:
            transaction.status = "completed"
            if paynow_reference:
                transaction.provider_ref = paynow_reference

        audit = AuditLog(
            actor_id=booking.user_id,
            role="system",
            action="PAYMENT_CONFIRMED_LEGACY",
            resource_id=str(booking_id),
            metadata_json={"provider_ref": paynow_reference, "confirmed_at": zims_now.isoformat()},
        )
        db.add(audit)
        db.commit()
        return {"status": "CONFIRMED", "booking_id": booking_id}

    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Legacy confirm failed for booking {booking_id}: {exc}")
        raise HTTPException(status_code=500, detail="Confirm state transition failed")


# ── Internal helper: write a CONFIRMED booking to DB ─────────────────────────
def _create_confirmed_booking(
    db: Session,
    req,                        # BookingCreate or None (when called from draft confirm)
    slot: str,
    booking_date: date,
    zims_now: datetime,
    paynow_reference: Optional[str],
    draft: Optional[dict] = None,
    payment_amount: Optional[float] = None,
    payment_method: Optional[str] = None,
    paynow_ref: Optional[str] = None,
) -> dict:
    """
    Atomically inserts a CONFIRMED booking + PaymentTransaction + AuditLog.
    Used by both the cash path (from create_draft) and the webhook confirm path.
    Returns a dict with 'id' and booking fields.
    """
    is_cash = (req is not None) and req.payment_method in (None, "CASH", "cash")

    # Resolve fields — prefer draft dict over req
    name            = (draft or {}).get("name") or (req.name if req else "")
    service         = (draft or {}).get("service") or (req.service if req else "")
    user_id         = (draft or {}).get("user_id") or (req.user_id if req else "")
    pay_method      = payment_method or (req.payment_method if req else None)
    pay_amount      = payment_amount or (req.payment_amount if req else 0.0)
    pn_ref          = paynow_ref or (req.paynow_ref if req else None)

    new_booking = Booking(
        name=name,
        service=service,
        user_id=user_id,
        slot_time=slot,
        booking_date=booking_date,
        status="CONFIRMED",
        reserved_until=None,   # No TTL — booking is confirmed immediately
    )

    try:
        db.add(new_booking)
        db.flush()  # Materialise the ID

        # ── PaymentTransaction ───────────────────────────────────────────
        if not is_cash:
            transaction = PaymentTransaction(
                booking_id=new_booking.id,
                amount=pay_amount,
                currency="USD",
                provider=pay_method,
                status="completed",
                paynow_ref=pn_ref,
                provider_ref=paynow_reference,
                metadata_json={
                    "service": service,
                    "date": str(booking_date),
                    "slot": slot,
                    "initiated_by": user_id,
                    "confirmed_via": "webhook",
                },
            )
            db.add(transaction)

        # ── Audit log ────────────────────────────────────────────────────
        audit = AuditLog(
            actor_id=user_id,
            role="system" if not is_cash else "customer",
            action="BOOKING_CONFIRMED" if not is_cash else "CASH_BOOKING_CREATED",
            resource_id=str(new_booking.id),
            metadata_json={
                "service": service,
                "date": str(booking_date),
                "slot": slot,
                "payment_method": pay_method,
                "provider_ref": paynow_reference,
                "confirmed_at": zims_now.isoformat(),
            },
        )
        db.add(audit)

        # ── CRM sync (non-critical) ──────────────────────────────────────
        try:
            customer_crud.upsert_from_booking(db, clerk_id=user_id, name=name)
        except Exception:
            pass

        db.commit()
        db.refresh(new_booking)

        return {
            "id":           new_booking.id,
            "slot_time":    new_booking.slot_time,
            "booking_date": str(new_booking.booking_date),
            "status":       new_booking.status,
            "name":         new_booking.name,
            "service":      new_booking.service,
            "user_id":      new_booking.user_id,
            "created_at":   new_booking.created_at.isoformat() if new_booking.created_at else None,
        }

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This slot was just taken by someone else. Please try another time.",
        )
    except SQLAlchemyError as exc:
        db.rollback()
        logger.error(f"Database error creating confirmed booking: {exc}")
        raise HTTPException(status_code=500, detail="Failed to save booking to database")


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/{booking_id}/cancel
#  Called by the PayNow microservice when IPN reports cancelled or failed.
#  Also handles legacy PENDING bookings from before the draft-token era.
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/{booking_id}/cancel")
def cancel_booking_payment(booking_id: int, request: Request, db: db_dependency) -> dict:
    secret = request.headers.get("X-Internal-Secret")
    if not INTERNAL_SECRET or secret != INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: Internal Clearance Only")

    booking = booking_crud.get_by_id(db, booking_id)
    if not booking:
        # In the new architecture, a cancelled-before-confirmed draft has no DB row.
        # That's the whole point — nothing to clean up.
        logger.info(f"Cancel called for booking {booking_id} — not found in DB (already a clean draft). No-op.")
        return {"status": "NO_BOOKING_FOUND", "booking_id": booking_id, "note": "Draft was never written to DB — slot is already free."}

    if booking.status == "CANCELLED":
        return {"status": "CANCELLED", "booking_id": booking_id, "idempotent": True}

    if booking.status not in ("PENDING", "VERIFYING"):
        logger.warning(f"Cancel rejected for booking {booking_id}: status is {booking.status}")
        raise HTTPException(
            status_code=409,
            detail=f"Cannot cancel a booking in status {booking.status}",
        )

    try:
        booking.status = "CANCELLED"
        booking.reserved_until = None

        transaction = booking_crud.get_latest_transaction(db, booking_id)
        if transaction and transaction.status in ("pending", "manual_review"):
            transaction.status = "failed"

        audit = AuditLog(
            actor_id=booking.user_id,
            role="system",
            action="PAYMENT_CANCELLED",
            resource_id=str(booking_id),
            metadata_json={
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
#  GET /api/book/{booking_id}/payment-status
#  Frontend polls this during awaiting_payment.
#  In the new architecture, booking_id may be 0 (draft) — we check by
#  paynow_ref if no DB row exists yet.
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/{booking_id}/payment-status", response_model=PaymentStatusResponse)
def get_payment_status(
    booking_id: int,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        booking = booking_crud.get_by_id(db, booking_id)

        # booking_id = 0 is the sentinel for "draft not yet in DB"
        # The frontend should also pass ?paynow_ref= so we can look up by tx.
        if not booking:
            return {
                "bookingId": booking_id,
                "status": "PENDING",
                "transactionRef": None,
            }

        is_admin = user.get("metadata", {}).get("role") in ["admin", "owner"]
        if booking.user_id != user.get("sub") and not is_admin:
            raise HTTPException(status_code=403, detail="Forbidden: You do not own this booking")

        transaction = booking_crud.get_latest_transaction(db, booking_id)

        if not transaction:
            return {"bookingId": booking_id, "status": "PENDING", "transactionRef": None}

        # ── Confirmed ───────────────────────────────────────────────────
        if transaction.status == "completed" or booking.status == "CONFIRMED":
            return {
                "bookingId": booking_id,
                "status": "PAID",
                "transactionRef": transaction.provider_ref or transaction.paynow_ref,
            }

        # ── Failed ──────────────────────────────────────────────────────
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

        # ── TTL expired ──────────────────────────────────────────────────
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

        # ── Still pending: active PayNow poll_url check (IPN fallback) ───
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
#  GET /api/book/{paynow_ref}/draft-status
#  New endpoint: frontend polls this BEFORE the booking has a DB ID.
#  Checks PaymentTransaction by paynow_ref UUID to detect webhook arrival.
# ═══════════════════════════════════════════════════════════════════════════
@router.get("/draft-status/{paynow_ref}")
def get_draft_payment_status(
    paynow_ref: str,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Polls status using the paynow_ref UUID (before a booking ID exists).
    Returns PENDING, PAID (with bookingId), or REJECTED.
    """
    tx = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.paynow_ref == paynow_ref)
        .first()
    )

    if not tx:
        return {"status": "PENDING", "bookingId": None}

    booking = booking_crud.get_by_id(db, tx.booking_id) if tx.booking_id else None

    if tx.status == "completed" and booking and booking.status == "CONFIRMED":
        return {
            "status": "PAID",
            "bookingId": tx.booking_id,
            "transactionRef": tx.provider_ref or tx.paynow_ref,
            "slot_time": booking.slot_time,
            "booking_date": str(booking.booking_date),
        }

    if tx.status in ("failed", "cancelled", "rejected"):
        return {
            "status": "REJECTED",
            "bookingId": None,
            "error": {
                "code": f"PAYMENT_{tx.status.upper()}",
                "message": "Payment was not completed.",
            },
        }

    return {"status": "PENDING", "bookingId": None}


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/cleanup-expired
#  Legacy cleanup — only relevant for PENDING rows from before the
#  draft-token era. New bookings never create PENDING rows.
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
        return {"cancelled": len(cancelled_ids), "ids": cancelled_ids}

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Cleanup failed")


# ═══════════════════════════════════════════════════════════════════════════
#  POST /api/book/verify-payment  (manual ref submission fallback)
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/verify-payment")
def submit_payment_reference(
    req: PaymentVerification,
    db: db_dependency,
    user: dict = Depends(get_current_user),
) -> dict:
    booking = booking_crud.get_by_id(db, req.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != user.get("sub"):
        raise HTTPException(status_code=403, detail="Forbidden")

    transaction = booking_crud.get_pending_transaction(db, req.booking_id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Pending transaction not found")

    transaction.provider_ref = req.provider_ref
    transaction.status = "manual_review"
    booking.status = "VERIFYING"
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
        return {"message": "Reference submitted. Our team will verify shortly."}
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
        raise HTTPException(status_code=403, detail="Forbidden")

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
def list_bookings(db: db_dependency, booking_date: Optional[date] = None) -> List[Booking]:
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
    # Only return CONFIRMED bookings to the user — drafts don't exist in DB
    return [b for b in booking_crud.list_by_user(db, user_id) if b.status in ("CONFIRMED", "COMPLETED", "VERIFYING")]
