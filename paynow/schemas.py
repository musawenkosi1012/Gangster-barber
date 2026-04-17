from pydantic import BaseModel, EmailStr
from typing import Optional


class InitiatePaymentRequest(BaseModel):
    """Request body for initiating a payment."""
    booking_id: str           # paynow_ref UUID — used as PayNow reference string
    customer_name: str
    customer_email: str
    service: str
    amount: float
    phone_number: Optional[str] = None
    payment_method: Optional[str] = "web"  # "web", "mobile", "onemoney", "innbucks", "omari"
    # Draft token: signed payload carrying all booking fields.
    # Stored on the PayNow service and forwarded to the backend webhook
    # so the backend can create the booking row only after payment is confirmed.
    draft_token: Optional[str] = None


class CheckStatusRequest(BaseModel):
    poll_url: str


class OmariOTPRequest(BaseModel):
    otp: str
    remote_otp_url: str


class PaymentResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    redirect_url: Optional[str] = None
    poll_url: Optional[str] = None
    instructions: Optional[str] = None
    error: Optional[str] = None
    payment_method: Optional[str] = None

    # Advanced Express Checkout (InnBucks, O'Mari)
    authorization_code: Optional[str] = None
    authorization_expires: Optional[str] = None
    deep_link: Optional[str] = None
    otpreference: Optional[str] = None
    remoteotpurl: Optional[str] = None
    merchant_trace: Optional[str] = None
