from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter
from slowapi.util import get_remote_address
import logging
import hashlib
import os
import httpx
from typing import Optional, List
from paynow_client import get_paynow_client
from schemas import InitiatePaymentRequest, PaymentResponse, CheckStatusRequest, OmariOTPRequest

router = APIRouter()
logger = logging.getLogger("paynow")

# ── Rate Limiter (Fix 12) ────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

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


async def notify_backend_of_payment(booking_id: str, status: str):
    """
    Internal bridge to sync payment status with the main core backend.
    Enforces the Contract: Verification must happen before state promotion.
    """
    backend_url = os.getenv("BACKEND_API_URL", "")
    internal_secret = os.getenv("INTERNAL_API_SECRET", "")
    
    if not backend_url:
        logger.error("BACKEND_API_URL not configured")
        return

    try:
        async with httpx.AsyncClient() as client:
            # Shift-Left Security: Use internal secret to authorize state change
            response = await client.post(
                f"{backend_url}/api/book/{booking_id}/confirm",
                headers={"X-Internal-Secret": internal_secret},
                timeout=15.0
            )
            
            if response.status_code == 200:
                logger.info(f"✅ Booking {booking_id} verified and confirmed by Core.")
            else:
                logger.error(f"❌ Core rejected confirmation for {booking_id}: {response.text}")

    except Exception as e:
        logger.error(f"❌ Backend synchronization failure: {e}")


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
        booking_id = data.get("Reference") or data.get("reference")

        if status in ["paid", "awaiting delivery", "delivered"]:
            if booking_id:
                # Fix 9: Idempotency — check current booking status before updating
                backend_url = os.getenv("BACKEND_API_URL", "")
                if backend_url:
                    try:
                        async with httpx.AsyncClient() as client:
                            check = await client.get(
                                f"{backend_url}/api/book/{booking_id}/payment-status",
                                timeout=5.0
                            )
                            if check.status_code == 200:
                                check_data = check.json()
                                if check_data.get("paid"):
                                    logger.info(f"⏭️ Booking {booking_id} already confirmed — skipping duplicate webhook.")
                                    return {"status": "already_processed", "reference": booking_id}
                    except Exception as e:
                        logger.warning(f"Idempotency check failed (proceeding anyway): {e}")

                await notify_backend_of_payment(booking_id, "CONFIRMED")

        return {"status": "verified", "reference": booking_id}

    except Exception as e:
        logger.exception(f"Unexpected error in Paynow webhook: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@router.post("/initiate", response_model=PaymentResponse)
@limiter.limit("5/minute")
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

        if response.success:
            return PaymentResponse(
                success=True,
                status="sent",
                redirect_url=response.redirect_url,
                poll_url=response.poll_url,
                instructions=response.instructions,
                authorization_code=getattr(response, "authorization_code", None),
                otpreference=getattr(response, "otpreference", None)
            )
        else:
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
