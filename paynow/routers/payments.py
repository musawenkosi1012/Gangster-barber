from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import hashlib
import os
import httpx
from typing import Optional, List
from paynow_client import get_paynow_client
from schemas import InitiatePaymentRequest, PaymentResponse, CheckStatusRequest, OmariOTPRequest

router = APIRouter()
logger = logging.getLogger("paynow")

# ── Rate Limiter (graceful — disabled if slowapi unavailable) ────────────────
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
    _has_limiter = True
except ImportError:
    limiter = None
    _has_limiter = False

def _rate_limit(rule: str):
    """No-op decorator when slowapi is unavailable."""
    def decorator(fn):
        if _has_limiter and limiter:
            return limiter.limit(rule)(fn)
        return fn
    return decorator

# ── Shared-secret auth for /initiate (Fix 4) ────────────────────────────────
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "")
auth_scheme = HTTPBearer(auto_error=False)

async def verify_request_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme)
):
    """
    Verifies the caller using a shared internal secret passed as a Bearer token.
    Set INTERNAL_API_SECRET in Vercel env vars for both frontend (NEXT_PUBLIC_ prefix
    should NOT be used — pass via server-side API route proxy) and paynow service.
    Falls back gracefully if the secret is not configured (dev mode).
    """
    if not INTERNAL_SECRET:
        # Secret not configured — warn but allow (for dev/initial deploy)
        logger.warning("INTERNAL_API_SECRET not set — /initiate is unauthenticated. Set this env var in production.")
        return True

    if not credentials or credentials.credentials != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing API secret")
    return True


async def _call_backend(path: str, headers: dict, label: str) -> bool:
    """POST to the core backend. Returns True on success."""
    backend_url = os.getenv("BACKEND_API_URL", "")
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    if not backend_url:
        logger.error("BACKEND_API_URL not configured")
        return False
    headers["X-Internal-Secret"] = internal_secret
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{backend_url}{path}", headers=headers, timeout=15.0)
            if resp.status_code == 200:
                logger.info(f"✅ {label} — {path}")
                return True
            else:
                logger.error(f"❌ {label} rejected: {resp.status_code} {resp.text}")
                return False
    except Exception as exc:
        logger.error(f"❌ {label} failed: {exc}")
        return False


async def notify_backend_of_payment(booking_id: str, paynow_reference: Optional[str] = None):
    """
    Calls POST /api/book/{id}/confirm after IPN hash verification.
    Forwards the Paynow reference so it lands on PaymentTransaction.provider_ref.
    """
    headers = {}
    if paynow_reference:
        headers["X-Paynow-Reference"] = paynow_reference
    await _call_backend(f"/api/book/{booking_id}/confirm", headers, f"Confirm booking {booking_id}")


async def notify_backend_payment_failed(booking_id: str):
    """
    Calls POST /api/book/{id}/cancel after IPN reports cancelled or failed.
    Sets transaction.status = 'failed' and booking.status = 'CANCELLED' in one atomic write.
    """
    await _call_backend(f"/api/book/{booking_id}/cancel", {}, f"Cancel booking {booking_id}")


@router.post("/webhook")
async def paynow_webhook(request: Request):
    """
    Receives and VERIFIES payment status updates from Paynow.
    Fix 9: Idempotency guard — skips re-processing already confirmed bookings.
    Fix 11: Deterministic hash field order per Paynow documentation.
    """
    try:
        paynow = get_paynow_client()
        form = await request.form()
        data = dict(form)

        provided_hash = data.pop("hash", None) or data.pop("Hash", None)
        if not provided_hash:
            return JSONResponse(status_code=400, content={"error": "Missing Hash"})

        # Fix 11: Build verify string in Paynow-specified field order (case-insensitive key lookup)
        # Paynow sends fields in this canonical order per their documentation
        PAYNOW_FIELD_ORDER = [
            "reference", "paynowreference", "amount", "status",
            "pollurl", "hash"
        ]

        # Build a case-insensitive lookup map of form fields (excluding hash itself)
        field_map = {}
        for key, value in form.items():
            if key.lower() != "hash":
                field_map[key.lower()] = str(value)

        # Concatenate in canonical order, then append any remaining fields
        ordered_keys = [k for k in PAYNOW_FIELD_ORDER if k in field_map]
        remaining_keys = [k for k in field_map if k not in PAYNOW_FIELD_ORDER]

        verify_string = ""
        for key in ordered_keys + remaining_keys:
            verify_string += field_map[key]
        verify_string += paynow.integration_key

        calculated_hash = hashlib.sha512(verify_string.encode("utf-8")).hexdigest().upper()

        if calculated_hash != provided_hash.upper():
            logger.warning("SECURITY ALERT: Webhook hash mismatch.")
            return JSONResponse(status_code=401, content={"error": "Invalid Hash Signature"})

        status = (data.get("Status") or data.get("status") or "").lower()
        # PayNow sends the booking reference we set when creating the payment
        booking_id = data.get("Reference") or data.get("reference")
        # The PayNow transaction reference (what the customer sees on their phone)
        paynow_reference = data.get("paynowreference") or data.get("PaynowReference") or data.get("PayNowReference")

        if status in ["paid", "awaiting delivery", "delivered"]:
            if booking_id:
                # Idempotency guard: skip if already confirmed
                backend_url = os.getenv("BACKEND_API_URL", "")
                if backend_url:
                    try:
                        async with httpx.AsyncClient() as client:
                            check = await client.get(
                                f"{backend_url}/api/book/{booking_id}/payment-status",
                                timeout=5.0,
                            )
                            if check.status_code == 200:
                                check_data = check.json()
                                if check_data.get("status") == "PAID":
                                    logger.info(f"⏭️ Booking {booking_id} already confirmed — skipping duplicate webhook")
                                    return {"status": "already_processed", "reference": booking_id}
                    except Exception as exc:
                        logger.warning(f"Idempotency check failed (proceeding anyway): {exc}")

                # Forward reference to core so it lands on PaymentTransaction.provider_ref
                await notify_backend_of_payment(booking_id, paynow_reference)

        elif status in ["cancelled", "failed"]:
            # IPN explicitly reports failure — cancel the booking immediately
            # so the slot is released without waiting for the TTL to expire.
            if booking_id:
                logger.info(f"Payment {status} for booking {booking_id} — notifying backend to cancel")
                await notify_backend_payment_failed(booking_id)

        return {"status": "verified", "reference": booking_id}

    except Exception as e:
        logger.exception(f"Unexpected error in Paynow webhook: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/initiate", response_model=PaymentResponse)
@_rate_limit("5/minute")
async def initiate_payment(
    request: Request,
    req: InitiatePaymentRequest,
    _auth: bool = Depends(verify_request_auth)
):
    """
    Initiates a Paynow payment. Supports EcoCash, OneMoney, InnBucks, and O'Mari.
    Fix 4: Protected by shared-secret auth.
    Fix 12: Rate limited to 5 requests per minute per IP.
    """
    try:
        paynow = get_paynow_client()
        # Use the UUID reference from the frontend — shows a real reference in Paynow dashboard
        payment = paynow.create_payment(str(req.booking_id), req.customer_email)
        payment.add(f"Barber Booking — {req.service}", req.amount)

        method_map = {
            "mobile": "ecocash",
            "ecocash": "ecocash",
            "onemoney": "onemoney",
            "innbucks": "innbucks",
            "omari": "omari"
        }

        paynow_method = method_map.get(req.payment_method)

        if paynow_method:
            response = paynow.send_mobile(payment, req.phone_number, paynow_method)
        else:
            response = paynow.send(payment)

        def _str(val) -> str | None:
            """Return val if it's an actual string, else None.
            The Paynow SDK sometimes returns the `str` type class instead of
            a value for fields that are not applicable to the payment method."""
            return val if isinstance(val, str) else None

        if response.success:
            return PaymentResponse(
                success=True,
                status="sent",
                redirect_url=_str(getattr(response, "redirect_url", None)),
                poll_url=_str(getattr(response, "poll_url", None)),
                instructions=_str(getattr(response, "instructions", None)),
                authorization_code=_str(getattr(response, "authorization_code", None)),
                otpreference=_str(getattr(response, "otpreference", None))
            )
        else:
            logger.error(f"Paynow gateway rejected payment: {response.error!r}")
            return PaymentResponse(success=False, status="failed", error=response.error)

    except Exception as e:
        logger.error(f"Payment initiation failure: {e}")
        raise HTTPException(status_code=500, detail="Terminal failure during payment initiation.")


@router.get("/check-status", response_model=PaymentResponse)
async def check_status(poll_url: str = Query(..., description="Paynow poll URL to check transaction status")):
    """
    Fix 7: Changed to GET with query parameter (was POST with query param — inconsistent).
    """
    try:
        paynow = get_paynow_client()
        status = paynow.check_transaction_status(poll_url)
        return PaymentResponse(success=True, status=status.status, poll_url=poll_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
