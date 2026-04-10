from fastapi import APIRouter, Request, HTTPException, Response
from fastapi.responses import JSONResponse
import logging
import hashlib
import os
import httpx
from typing import Optional, List
from paynow_client import get_paynow_client
from schemas import InitiatePaymentRequest, PaymentResponse, OmariOTPRequest

router = APIRouter()
logger = logging.getLogger("paynow")

async def notify_backend_of_payment(booking_id: str, status: str):
    """
    Internal bridge to sync payment status with the main core backend (Port 8000).
    """
    backend_url = os.getenv("BACKEND_API_URL", "")
    try:
        async with httpx.AsyncClient() as client:
            # reference field in Paynow is our Booking ID
            response = await client.patch(
                f"{backend_url}/api/book/{booking_id}",
                json={"status": "PAID"}
            )
            if response.status_code == 200:
                logger.info(f"🔗 Successfully linked booking {booking_id} to PAID status.")
            else:
                logger.warning(f"⚠️ Failed to link booking {booking_id}. Core responded with {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Core Link Error: {e}")

@router.post("/webhook")
async def paynow_webhook(request: Request):
    """
    Receives and VERIFIES payment status updates from Paynow.
    Implements SHA512 hash verification as per Paynow documentation.
    """
    try:
        paynow = get_paynow_client()
        form = await request.form()
        data = dict(form)
        
        provided_hash = None
        verify_string = ""
        
        for key, value in form.items():
            if key.lower() == 'hash':
                provided_hash = value
                continue
            verify_string += str(value)
        
        if not provided_hash:
            return JSONResponse(status_code=400, content={"error": "Missing Hash"})

        verify_string += paynow.integration_key
        calculated_hash = hashlib.sha512(verify_string.encode('utf-8')).hexdigest().upper()

        if calculated_hash != provided_hash:
            logger.warning("SECURITY ALERT: Webhook hash mismatch.")
            return JSONResponse(status_code=401, content={"error": "Invalid Hash Signature"})

        status = (data.get('Status') or data.get('status') or "").lower()
        booking_id = data.get('Reference') or data.get('reference')
        
        if status in ["paid", "awaiting delivery", "delivered"]:
             if booking_id:
                 await notify_backend_of_payment(booking_id, "PAID")
            
        return {"status": "verified", "reference": booking_id}

    except Exception as e:
        logger.exception(f"Unexpected error in Paynow webhook: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.post("/initiate", response_model=PaymentResponse)
async def initiate_payment(req: InitiatePaymentRequest):
    """
    Advanced Initiate: Supports Mobile, InnBucks, and O'mari Express Flows.
    """
    try:
        paynow = get_paynow_client()
        payment = paynow.create_payment(str(req.booking_id), req.customer_email)
        payment.add(f"Appointment #{req.booking_id}", req.amount)

        method_map = {
            "mobile": "ecocash",
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
                authorization_code=getattr(response, 'authorization_code', None),
                otpreference=getattr(response, 'otpreference', None)
            )
        else:
            return PaymentResponse(success=False, error=response.error)
            
    except Exception as e:
        logger.error(f"Initiation Failure: {e}")
        raise HTTPException(status_code=500, detail="Terminal failure during payment initiation.")

@router.post("/check-status", response_model=PaymentResponse)
async def check_status(poll_url: str):
    try:
        paynow = get_paynow_client()
        status = paynow.check_transaction_status(poll_url)
        return PaymentResponse(success=True, status=status.status, poll_url=poll_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
