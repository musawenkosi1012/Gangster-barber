from sqlalchemy import Column, Integer, String, Boolean, DateTime, func, Text
from sqlalchemy.orm import relationship
from ..db.base import Base

class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False, index=True)
    phone = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, index=True, nullable=True)
    clerk_id = Column(String, unique=True, index=True, nullable=True) # The Master Key to identity
    status = Column(String, default="active") # active, vip, blocked
    notes = Column(Text, nullable=True)
    tags = Column(String, nullable=True) # Comma-separated tactical flags
    total_spend = Column(Integer, default=0) # Total LTV in USD/ZWG
    booking_count = Column(Integer, default=0)
    no_show_count = Column(Integer, default=0)
    last_visit_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # --- Relationships ---
    # We maintain virtual links to bookings and payments via Clerk ID or Phone
