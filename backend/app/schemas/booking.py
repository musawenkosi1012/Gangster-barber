from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date, datetime

class BookingBase(BaseModel):
    name: str
    service: str
    user_id: str
    booking_date: Optional[date] = None

class BookingCreate(BookingBase):
    slot_time: Optional[str] = None

class BookingUpdate(BaseModel):
    # All fields optional for PATCH
    name: Optional[str] = None
    service: Optional[str] = None
    slot_time: Optional[str] = None
    booking_date: Optional[date] = None

class Booking(BookingBase):
    id: int
    slot_time: str
    booking_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
