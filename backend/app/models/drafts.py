from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from ..db.base import Base


class PaymentDraft(Base):
    """
    Durable store for signed draft tokens awaiting PayNow confirmation.

    Replaces the in-memory dict used in the paynow microservice, which lost
    drafts across Vercel Lambda invocations (webhooks landed on a different
    instance than /initiate did).

    Lifecycle:
      1. bookings.create_draft INSERTS one row with a 10-minute expiry
      2. paynow webhook → bookings.confirm_from_draft looks up by paynow_ref,
         atomically sets consumed_at (idempotency), decodes the token,
         creates the CONFIRMED booking in one transaction
      3. A scheduled cleanup job deletes rows where expires_at < NOW() AND
         consumed_at IS NULL.
    """

    __tablename__ = "payment_drafts"
    __table_args__ = {"schema": "public"}

    paynow_ref = Column(String, primary_key=True)
    draft_token = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
