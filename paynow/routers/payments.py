"""
PayNow payment router — Gangster Barber
────────────────────────────────────────
Draft-in-cache architecture:

  /initiate  — receives the signed draft_token from the frontend,
               stores it in an in-process dict keyed by booking_id (paynow_ref).
               Passes booking_id as the PayNow reference string.

  /webhook   — verifies PayNow IPN hash, looks up the stored draft_token,
               forwards it to the backend's POST /api/book/confirm endpoint.
               On failure/cancellation → POST /api/book/{id}/cancel (legacy path).

Because Vercel is serverless (stateless between invocations), we persist the
draft_token in the PayNow payment metadata field so the webhook can always
recover it even across cold starts. The in-process dict is a best-effort cache
for warm invocations.
"""

from fastapi import APIRouter, Request, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import logging
import hashlib
import os
import httpx
from typing import Optional, Dict
from paynow_client import get_paynow_client
from schemas import InitiatePaymentRequest, PaymentResponse, CheckStatusRequest, OmariOTPRequest

router = APIRouter()
logger = logging.getLogger("paynow")

# ── In-process draft token store (warm-instance cache) ───────────────────────
# key: paynow_ref (UUID string)   value: signed draft_token string
_draft_store: Dict[str, str] = {}

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
    if not INTERNAL_SECRET:
        # HIGH-3: Hard fail in production — never allow unauthenticated access to /initiate on live deployments
        env = os.getenv("APP_ENV", "development")
        if env == "production":
            logger.error("CRITICAL: INTERNAL_API_SECRET is not set in production. Blocking all /initiate requests.")
            raise HTTPException(status_code=500, detail="Service misconfiguration. Contact support.")
        logger.warning("INTERNAL_API_SECRET not set — /initiate is unauthenticated. Set this env var in production.")
        return True
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


async def notify_backend_confirmed(draft_token: str, paynow_reference: Optional[str]) -> bool:
    """
    POST /api/book/confirm — creates the booking in DB for the first time.
    Carries the signed draft_token so the backend can decode all booking fields.
    """
    headers = {"X-Draft-Token": draft_token}
    if paynow_reference:
        headers["X-Paynow-Reference"] = paynow_reference
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

            # ── Look up draft_token ──────────────────────────────────────
            draft_token = _draft_store.get(reference)

            if draft_token:
                # New architecture: create booking in DB for the first time
                logger.info(f"✅ Draft token found for ref {reference} — creating confirmed booking")
                success = await notify_backend_confirmed(draft_token, paynow_reference)
                if success:
                    # Clean up store entry
                    _draft_store.pop(reference, None)
                else:
                    logger.error(f"Backend confirm failed for draft {reference}")
            else:
                # Legacy fallback: reference is a numeric booking ID (pre-draft era)
                logger.info(f"No draft token for ref {reference} — attempting legacy confirm")
                await notify_backend_legacy_confirm(reference, paynow_reference)

        elif status in ["cancelled", "failed"]:
            if reference:
                # Draft-token era: the booking may not exist in DB yet — that's fine,
                # the backend /cancel endpoint returns a no-op response for missing rows.
                logger.info(f"Payment {status} for ref {reference} — notifying backend")
                await notify_backend_payment_failed(reference)
                # Also evict from draft store
                _draft_store.pop(reference, None)

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
    Initiates a PayNow payment.
    Stores the draft_token in the in-process cache keyed by booking_id (paynow_ref).
    The draft_token is forwarded to the backend on webhook confirmation so the
    booking is created in the DB for the first time — never before payment.
    """
    try:
        # ── Store draft token for webhook recovery ───────────────────────
        if req.draft_token:
            _draft_store[req.booking_id] = req.draft_token
            logger.info(f"Draft token stored for ref {req.booking_id}")
        else:
            logger.warning(f"No draft_token in /initiate for ref {req.booking_id} — legacy flow assumed")

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
            # Initiation failed — evict draft so no orphan entry remains
            _draft_store.pop(req.booking_id, None)
            logger.error(f"PayNow gateway rejected payment: {response.error!r}")
            return PaymentResponse(success=False, status="failed", error=response.error)

    except Exception as e:
        _draft_store.pop(req.booking_id, None)
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
