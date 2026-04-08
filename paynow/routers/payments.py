from fastapi import APIRouter, HTTPException, Request
from schemas import InitiatePaymentRequest, CheckStatusRequest, PaymentResponse
from paynow_client import get_paynow_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/initiate", response_model=PaymentResponse)
async def initiate_payment(req: InitiatePaymentRequest):
    """
    Initiates a Paynow payment for a barber booking.

    - If `phone_number` is provided → EcoCash mobile payment.
    - Otherwise → Web-based redirect payment.
    """
    paynow = get_paynow_client()

    # Build the payment reference: booking ID + service name
    reference = f"Booking #{req.booking_id} - {req.service}"

    # Create the payment object
    payment = paynow.create_payment(reference, req.customer_email)

    # Add the service item with its price
    service_label = f"{req.service} (Gangster Barber)"
    payment.add(service_label, req.amount)

    try:
        # --- Mobile (EcoCash) Payment ---
        if req.phone_number:
            phone = req.phone_number.strip().replace(" ", "")
            logger.info(f"Sending mobile payment to {phone} for booking #{req.booking_id}")
            response = paynow.send_mobile(payment, phone, "ecocash")

            if response.success:
                return PaymentResponse(
                    success=True,
                    poll_url=response.poll_url,
                    instructions=response.instructions,
                    payment_method="mobile",
                )
            else:
                logger.error(f"Mobile payment failed: {response.error}")
                return PaymentResponse(
                    success=False,
                    error=str(response.error),
                    payment_method="mobile",
                )

        # --- Web (Redirect) Payment ---
        else:
            logger.info(f"Sending web payment for booking #{req.booking_id}")
            response = paynow.send(payment)

            if response.success:
                return PaymentResponse(
                    success=True,
                    redirect_url=response.redirect_url,
                    poll_url=response.poll_url,
                    payment_method="web",
                )
            else:
                logger.error(f"Web payment failed: {response.error}")
                return PaymentResponse(
                    success=False,
                    error=str(response.error),
                    payment_method="web",
                )

    except Exception as e:
        logger.exception(f"Unexpected error during payment initiation: {e}")
        raise HTTPException(status_code=500, detail=f"Payment initiation failed: {str(e)}")


@router.post("/check-status")
async def check_payment_status(req: CheckStatusRequest):
    """
    Polls the Paynow API to check the current status of a transaction.
    Use the poll_url returned from /initiate.
    """
    paynow = get_paynow_client()

    try:
        status = paynow.check_transaction_status(req.poll_url)
        return {
            "paid": status.paid,
            "status": status.status,
        }
    except Exception as e:
        logger.exception(f"Failed to check transaction status: {e}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.post("/webhook")
async def paynow_webhook(request: Request):
    """
    Receives payment status updates from Paynow (result URL callback).
    Paynow POSTs form-encoded data here when a payment status changes.
    Log it and return 200 OK.
    """
    form = await request.form()
    data = dict(form)
    logger.info(f"PayNow Webhook received: {data}")

    # You can extend this to update a booking status in your main backend DB
    # Example: call main backend's PATCH /api/book/{booking_id} here

    return {"received": True}


@router.get("/services")
def list_services():
    """Returns available barber services with their prices (in USD)."""
    return [
        {"name": "Taper Fade",       "price": 5.00},
        {"name": "Lineup & Shape-Up", "price": 4.00},
        {"name": "The Full Gangster", "price": 8.00},
        {"name": "Beard Sculpt",      "price": 4.00},
    ]
