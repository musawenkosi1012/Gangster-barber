from pydantic import BaseModel, ConfigDict
from typing import Optional, Union
from datetime import date, datetime


class DraftTokenResponse(BaseModel):
    """
    Returned by POST /api/book/ for electronic payments.
    No booking row exists in the DB yet — just a signed draft token.
    """
    draft_token: str
    slot_time: str
    booking_date: str
    expires_at: str


class BookingBase(BaseModel):
    name: str
    service: str
    user_id: str
    booking_date: Optional[date] = None
    notes: Optional[str] = None

class BookingCreate(BookingBase):
    slot_time: Optional[str] = None
    payment_method: Optional[str] = "CASH"   # CASH, ECO_CASH, ONE_MONEY, INN_BUCKS
    payment_amount: Optional[float] = 0.0
    poll_url: Optional[str] = None            # Paynow poll URL (set after initiation)
    paynow_ref: Optional[str] = None         # UUID reference generated before /initiate call

class BookingUpdate(BaseModel):
    name: Optional[str] = None
    service: Optional[str] = None
    slot_time: Optional[str] = None
    booking_date: Optional[date] = None
    notes: Optional[str] = None
    # status is intentionally excluded — status transitions are controlled
    # server-side only (payment webhook, admin actions). Customers cannot
    # self-confirm or self-cancel via PATCH.

class BookingStatusUpdate(BaseModel):
    """Separate schema for admin-only status changes."""
    status: str

class Booking(BookingBase):
    id: int
    slot_time: str
    booking_date: date
    status: str
    created_at: datetime
    # P1: Server-authoritative price returned so the frontend passes the canonical
    # amount to Paynow /initiate — clients can no longer inject their own price.
    canonical_amount: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
