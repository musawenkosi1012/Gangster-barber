from sqlalchemy import Column, Integer, String, Date, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from ..db.base import Base

class Service(Base):
    __tablename__ = "services"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    slug = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    price = Column(Float, nullable=False)
    booking_fee = Column(Float, nullable=True, default=0.0)
    duration_minutes = Column(Integer, default=40)
    # image_url decommissioned in favor of multi-asset images relationship
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    category = Column(String, nullable=True)

    # Multi-Asset Support Relationship (Antigravity Upgrade)
    images = relationship("ServiceImage", back_populates="service", cascade="all, delete-orphan", lazy="selectin")

class ServiceImage(Base):
    """
    Tactical Asset Management: Allows multiple visual markers for a single service.
    Follows the 2026 'Infinite Relation' pattern.
    """
    __tablename__ = "service_images"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String, nullable=False) # Physical/Cloud storage locator
    alt_text = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    service_id = Column(Integer, ForeignKey("public.services.id", ondelete="CASCADE"))
    
    service = relationship("Service", back_populates="images")

class BlockedSlot(Base):
    __tablename__ = "blocked_slots"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    slot_time = Column(String, nullable=False)
    reason = Column(String, nullable=True) # e.g., 'Power Outage', 'Lunch', 'WhatsApp Booking'
