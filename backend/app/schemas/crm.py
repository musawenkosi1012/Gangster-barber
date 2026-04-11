from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class CustomerBase(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = "active"
    notes: Optional[str] = None
    tags: Optional[str] = None

class CustomerCreate(CustomerBase):
    clerk_id: Optional[str] = None

class CustomerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[str] = None

class Customer(CustomerBase):
    id: int
    clerk_id: Optional[str] = None
    total_spend: Optional[int] = None
    booking_count: Optional[int] = None
    no_show_count: Optional[int] = None
    last_visit_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class CustomerDetail(Customer):
    # Reliability Score as a computed float
    reliability_pct: float
    # List of past bookings for the History Tab
    history: List[dict] = []
    # Favorite service based on historical frequency
    favorite_service: Optional[str] = None
