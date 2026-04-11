from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime

class BookingBase(BaseModel):
    name: str
    service: str
    user_id: str
    booking_date: Optional[date] = None
    notes: Optional[str] = None

class BookingCreate(BookingBase):
    slot_time: Optional[str] = None
    payment_method: Optional[str] = "CASH" # CASH, ECO_CASH, ONE_MONEY, INN_BUCKS
    payment_amount: Optional[float] = 0.0
    poll_url: Optional[str] = None # Paynow poll URL stored after payment initiation

class BookingUpdate(BaseModel):
    name: Optional[str] = None
    service: Optional[str] = None
    slot_time: Optional[str] = None
    booking_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class Booking(BookingBase):
    id: int
    slot_time: str
    booking_date: date
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
