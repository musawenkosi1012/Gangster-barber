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


class CheckStatusRequest(BaseModel):
    """Request body for checking a payment status."""
    poll_url: str


class PaymentResponse(BaseModel):
    """Response returned after payment initiation."""
    success: bool
    redirect_url: Optional[str] = None   # For web-based payments
    poll_url: Optional[str] = None
    instructions: Optional[str] = None  # For mobile payments
    error: Optional[str] = None
    payment_method: str  # "web" or "mobile"
