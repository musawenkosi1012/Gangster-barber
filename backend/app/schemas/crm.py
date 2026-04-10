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

class CustomerUpdate(CustomerBase):
    pass

class Customer(CustomerBase):
    id: int
    total_spend: int
    booking_count: int
    no_show_count: int
    last_visit_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CustomerDetail(Customer):
    # Reliability Score as a computed float
    reliability_pct: float
    # List of past bookings for the History Tab
    history: List[dict] = []
    # Favorite service based on historical frequency
    favorite_service: Optional[str] = None
