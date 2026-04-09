from pydantic import BaseModel, EmailStr
from typing import Optional


class InitiatePaymentRequest(BaseModel):
    """Request body for initiating a payment."""
    booking_id: int
    customer_name: str
    customer_email: str
    service: str
    amount: float
    # For mobile (EcoCash) payments
    phone_number: Optional[str] = None
    # For Express Checkout (vmc, zimswitch)
    payment_method: Optional[str] = "web"  # "web", "mobile", "vmc", "zimswitch"
    token: Optional[str] = None


class CheckStatusRequest(BaseModel):
    """Request body for checking a payment status."""
    poll_url: str


class OmariOTPRequest(BaseModel):
    """Request for O'mari Step 2: OTP submission."""
    otp: str
    remote_otp_url: str


class PaymentResponse(BaseModel):
    """Response returned after payment initiation."""
    success: bool
    redirect_url: Optional[str] = None   # For web-based payments
    poll_url: Optional[str] = None
    instructions: Optional[str] = None  # For mobile payments
    error: Optional[str] = None
    payment_method: Optional[str] = None
    
    # Advanced Express Checkout (InnBucks, O'Mari)
    authorization_code: Optional[str] = None
    authorization_expires: Optional[str] = None
    deep_link: Optional[str] = None
    otpreference: Optional[str] = None
    remoteotpurl: Optional[str] = None
    merchant_trace: Optional[str] = None
