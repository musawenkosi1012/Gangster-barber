from sqlalchemy import Column, Integer, String, Date, DateTime, func, UniqueConstraint
from ..db.base import Base

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        UniqueConstraint('booking_date', 'slot_time', name='_date_slot_uc'),
        {"schema": "public"}
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    service = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    slot_time = Column(String, nullable=False)
    status = Column(String, default="PENDING")
    booking_date = Column(Date, server_default=func.current_date())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
