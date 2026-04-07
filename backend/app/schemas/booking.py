from pydantic import BaseModel
from typing import Optional

class BookingBase(BaseModel):
    name: str
    service: str
    user_id: str

class BookingCreate(BookingBase):
    slot_time: Optional[str] = None

class Booking(BookingBase):
    slot_time: str

    class Config:
        from_attributes = True
