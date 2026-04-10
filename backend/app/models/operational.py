from sqlalchemy import Column, Integer, String, Date, Float, Boolean
from ..db.base import Base

class Service(Base):
    __tablename__ = "services"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    slug = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    duration_minutes = Column(Integer, default=40)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    category = Column(String, nullable=True)

class BlockedSlot(Base):
    __tablename__ = "blocked_slots"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    slot_time = Column(String, nullable=False)
    reason = Column(String, nullable=True) # e.g., 'Power Outage', 'Lunch', 'WhatsApp Booking'
