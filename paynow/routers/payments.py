"""
PayNow payment router — Gangster Barber
────────────────────────────────────────
Stateless draft architecture:

  /initiate  — just calls the PayNow gateway. The draft_token has already been
               persisted server-side by the backend's /api/book/create-draft
               endpoint, keyed by paynow_ref (booking_id). Nothing is stored
               here — Vercel Lambdas don't share memory.

  /webhook   — verifies PayNow IPN hash, forwards the paynow_ref to the
               backend's POST /api/book/confirm via the X-Paynow-Ref header.
               The backend does the atomic draft-consume + booking creation.

This removed an earlier in-process `_draft_store` dict that silently dropped
drafts whenever the webhook hit a cold Lambda — almost always, in practice.
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import hashlib
import os
import httpx
from typing import Optional
from paynow_client import get_paynow_client
from schemas import InitiatePaymentRequest, PaymentResponse, CheckStatusRequest, OmariOTPRequest

router = APIRouter()
logger = logging.getLogger("paynow")

# ── Rate Limiter ─────────────────────────────────────────────────────────────
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
    _has_limiter = True
except ImportError:
    limiter = None
    _has_limiter = False

def _rate_limit(rule: str):
    def decorator(fn):
        if _has_limiter and limiter:
            return limiter.limit(rule)(fn)
        return fn
    return decorator

# ── Shared-secret auth ────────────────────────────────────────────────────────
INTERNAL_SECRET = os.getenv("INTERNAL_API_SECRET", "")
auth_scheme = HTTPBearer(auto_error=False)

async def verify_request_auth(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme)
):
    # Fail-closed: if the secret is not configured at all, refuse every request
    # rather than falling through to an open endpoint.
    if not INTERNAL_SECRET:
        logger.critical(
            "INTERNAL_API_SECRET is not set. "
            "Refusing /initiate — set the env var to enable payments."
        )
        raise HTTPException(
            status_code=503,
            detail="Service misconfigured: INTERNAL_API_SECRET not set on this instance.",
        )
    if not credentials or credentials.credentials != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing API secret")
    return True


# ── Backend call helpers ──────────────────────────────────────────────────────

async def _call_backend(path: str, headers: dict, label: str) -> bool:
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


async def notify_backend_confirmed(
    paynow_ref: str,
    paynow_reference: Optional[str],
    ipn_amount: Optional[str] = None,
) -> bool:
    """
    POST /api/book/confirm — creates the booking in DB for the first time.
    Carries the paynow_ref (for atomic draft consume) and the IPN-reported
    amount (X-Payment-Amount) so the backend can verify against the expected
    service price stored in the draft.
    """
    headers = {"X-Paynow-Ref": paynow_ref}
    if paynow_reference:
        headers["X-Paynow-Reference"] = paynow_reference
    if ipn_amount:
        headers["X-Payment-Amount"] = str(ipn_amount)
    return await _call_backend("/api/book/confirm", headers, "Create confirmed booking from draft")


async def notify_backend_legacy_confirm(booking_id: str, paynow_reference: Optional[str]) -> bool:
    """
    Legacy path: promote an existing PENDING booking row (pre-draft-token era).
    """
    headers = {}
    if paynow_reference:
        headers["X-Paynow-Reference"] = paynow_reference
    return await _call_backend(f"/api/book/{booking_id}/confirm", headers, f"Legacy confirm booking {booking_id}")


async def notify_backend_payment_failed(booking_id: str) -> bool:
    """
    POST /api/book/{id}/cancel — sets booking CANCELLED + transaction failed.
    """
    return await _call_backend(
        f"/api/book/{booking_id}/cancel", {}, f"Cancel booking {booking_id}"
    )


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def paynow_webhook(request: Request):
    """
    Receives and verifies payment status updates from PayNow IPN.

    On 'paid':
      1. Looks up the stored draft_token by the reference (paynow_ref UUID).
      2. If draft_token found → POST /api/book/confirm (creates booking in DB).
      3. If no draft_token (legacy flow) → POST /api/book/{id}/confirm (promotes PENDING row).

    On 'cancelled'/'failed':
      → POST /api/book/{id}/cancel (idempotent, no-op if row doesn't exist)
    """
    try:
        paynow = get_paynow_client()
        form = await request.form()
        data = dict(form)

        provided_hash = data.pop("hash", None) or data.pop("Hash", None)
        if not provided_hash:
            return JSONResponse(status_code=400, content={"error": "Missing Hash"})

        # Build verify string in PayNow-specified canonical field order
        PAYNOW_FIELD_ORDER = [
            "reference", "paynowreference", "amount", "status",
            "pollurl", "hash"
        ]

        field_map = {}
        for key, value in form.items():
            if key.lower() != "hash":
                field_map[key.lower()] = str(value)

        ordered_keys = [k for k in PAYNOW_FIELD_ORDER if k in field_map]
        remaining_keys = [k for k in field_map if k not in PAYNOW_FIELD_ORDER]

        verify_string = ""
        for key in ordered_keys + remaining_keys:
            verify_string += field_map[key]
        verify_string += paynow.integration_key

        calculated_hash = hashlib.sha512(verify_string.encode("utf-8")).hexdigest().upper()

        if calculated_hash != provided_hash.upper():
            logger.warning("SECURITY ALERT: Webhook hash mismatch — possible forgery.")
            return JSONResponse(status_code=401, content={"error": "Invalid Hash Signature"})

        status = (data.get("Status") or data.get("status") or "").lower()
        # 'reference' is the paynow_ref UUID we set when creating the payment
        reference = data.get("Reference") or data.get("reference") or ""
        paynow_reference = (
            data.get("paynowreference")
            or data.get("PaynowReference")
            or data.get("PayNowReference")
        )
        # IPN-reported amount — forwarded to backend for price verification
        ipn_amount = (
            data.get("amount")
            or data.get("Amount")
            or field_map.get("amount")
        )

        if status in ["paid", "awaiting delivery", "delivered"]:
            if not reference:
                logger.error("Webhook paid event missing reference field")
                return JSONResponse(status_code=400, content={"error": "Missing reference"})

            # ── Idempotency check ────────────────────────────────────────
            backend_url = os.getenv("BACKEND_API_URL", "")
            if backend_url:
                try:
                    async with httpx.AsyncClient() as client:
                        check = await client.get(
                            f"{backend_url}/api/book/draft-status/{reference}",
                            timeout=5.0,
                        )
                        if check.status_code == 200:
                            check_data = check.json()
                            if check_data.get("status") == "PAID":
                                logger.info(f"⏭️ Draft {reference} already confirmed — skipping duplicate webhook")
                                return {"status": "already_processed", "reference": reference}
                except Exception as exc:
                    logger.warning(f"Idempotency check failed (proceeding anyway): {exc}")

            # ── Forward paynow_ref to backend for atomic draft consume ──
            logger.info(f"✅ Paid event for ref {reference} (amount={ipn_amount}) — confirming via backend")
            success = await notify_backend_confirmed(reference, paynow_reference, ipn_amount)
            if not success:
                # Fall back to legacy confirm (reference may be a numeric booking ID
                # from the pre-draft era — backend handles the lookup).
                logger.info(f"Draft confirm failed for {reference} — trying legacy confirm")
                await notify_backend_legacy_confirm(reference, paynow_reference)

        elif status in ["cancelled", "failed"]:
            if reference:
                # The booking may not exist in DB yet — that's fine, the backend
                # /cancel endpoint returns a no-op response for missing rows.
                logger.info(f"Payment {status} for ref {reference} — notifying backend")
                await notify_backend_payment_failed(reference)

        return {"status": "verified", "reference": reference}

    except Exception as e:
        logger.exception(f"Unexpected error in PayNow webhook: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


# ── Initiate ──────────────────────────────────────────────────────────────────

@router.post("/initiate", response_model=PaymentResponse)
@_rate_limit("5/minute")
async def initiate_payment(
    request: Request,
    req: InitiatePaymentRequest,
    _auth: bool = Depends(verify_request_auth)
):
    """
    Initiates a PayNow payment. The draft_token is already persisted server-side
    by the backend's /api/book/create-draft call (keyed by paynow_ref), so
    nothing needs to be kept here — this service stays fully stateless.
    """
    try:
        paynow = get_paynow_client()
        payment = paynow.create_payment(str(req.booking_id), req.customer_email)
        payment.add(f"Barber Booking — {req.service}", req.amount)

        method_map = {
            "mobile":    "ecocash",
            "ecocash":   "ecocash",
            "onemoney":  "onemoney",
            "innbucks":  "innbucks",
            "omari":     "omari",
        }
        paynow_method = method_map.get(req.payment_method)

        if paynow_method:
            response = paynow.send_mobile(payment, req.phone_number, paynow_method)
        else:
            response = paynow.send(payment)

        def _str(val) -> Optional[str]:
            return val if isinstance(val, str) else None

        if response.success:
            return PaymentResponse(
                success=True,
                status="sent",
                redirect_url=_str(getattr(response, "redirect_url", None)),
                poll_url=_str(getattr(response, "poll_url", None)),
                instructions=_str(getattr(response, "instructions", None)),
                authorization_code=_str(getattr(response, "authorization_code", None)),
                otpreference=_str(getattr(response, "otpreference", None)),
            )
        else:
            logger.error(f"PayNow gateway rejected payment: {response.error!r}")
            return PaymentResponse(success=False, status="failed", error=response.error)

    except Exception as e:
        logger.error(f"Payment initiation failure: {e}")
        raise HTTPException(status_code=500, detail="Terminal failure during payment initiation.")


# ── Check status ──────────────────────────────────────────────────────────────

@router.get("/check-status", response_model=PaymentResponse)
async def check_status(poll_url: str = Query(..., description="PayNow poll URL")):
    try:
        paynow = get_paynow_client()
        status = paynow.check_transaction_status(poll_url)
        return PaymentResponse(success=True, status=status.status, poll_url=poll_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
