from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date

class ServiceBase(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    price: float
    duration_minutes: Optional[int] = 40
    # image_url decommissioned
    is_active: Optional[bool] = True
    sort_order: Optional[int] = 0
    category: Optional[str] = None

class ServiceCreate(ServiceBase):
    pass

class ServiceImageBase(BaseModel):
    image_path: str
    alt_text: Optional[str] = None
    sort_order: Optional[int] = 0

class ServiceImage(ServiceImageBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class Service(ServiceBase):
    id: int
    images: list[ServiceImage] = []
    model_config = ConfigDict(from_attributes=True)

class BlockedSlotBase(BaseModel):
    date: date
    slot_time: str
    reason: Optional[str] = None

class BlockedSlotCreate(BlockedSlotBase):
    pass

class BlockedSlot(BlockedSlotBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class AdminStats(BaseModel):
    total_revenue_today: float
    appointments_today: int
    no_show_rate: float
    next_appointment: Optional[str] = None
