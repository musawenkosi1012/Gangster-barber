from sqlalchemy import Column, Integer, String, Date, DateTime, func, Index
from sqlalchemy import text as sa_text
from ..db.base import Base

class Booking(Base):
    __tablename__ = "bookings"
    # Partial unique index — only active/in-progress statuses are constrained.
    # CANCELLED rows are excluded so the same slot can be re-booked after a
    # cancellation without an IntegrityError.
    # The DDL for this index lives in migrations/add_active_slot_unique_index.sql.
    # SQLAlchemy doesn't enforce the WHERE clause itself (it's DB-side only),
    # but declaring it here keeps schema intent visible in the model.
    __table_args__ = (
        Index(
            "idx_bookings_active_slot",
            "booking_date",
            "slot_time",
            unique=True,
            postgresql_where=sa_text(
                "status NOT IN ('CANCELLED')"
            ),
        ),
        {"schema": "public"},
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    service = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    slot_time = Column(String, nullable=False)
    # PENDING   → mobile payment sent, awaiting confirmation
    # RESERVED  → slot held for up to 10 min (web-pay redirect flow)
    # CONFIRMED → payment verified, slot locked
    # COMPLETED → service delivered
    # CANCELLED → payment timed out, failed, or user cancelled
    # NO-SHOW   → admin-marked
    # VERIFYING → manual review in IT Command Center
    status = Column(String, default="PENDING")
    notes = Column(String, nullable=True)  # Barber internal notes
    booking_date = Column(Date, server_default=func.current_date())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # TTL for the two-phase reservation (PENDING rows expire after this timestamp)
    reserved_until = Column(DateTime(timezone=True), nullable=True)
