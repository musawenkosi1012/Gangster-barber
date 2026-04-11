from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Float, Boolean
from sqlalchemy.sql import func
from ..db.base import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    actor_id = Column(String, nullable=False) # Clerk User ID
    role = Column(String, nullable=False) # role at time of action
    action = Column(String, nullable=False) # e.g., "PRICE_CHANGE", "BLOCK_SLOT", "REFUND"
    resource_id = Column(String, nullable=True) # ID of the object changed
    metadata_json = Column(JSON, nullable=True) # Before/After state
    ip_address = Column(String, nullable=True)

class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("public.bookings.id"), nullable=True)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    provider = Column(String, nullable=False) # EcoCash, OneMoney, InnBucks
    status = Column(String, default="PENDING") # pending, completed, failed, reversed, manual_review
    provider_ref = Column(String, nullable=True) # Reference code from provider
    poll_url = Column(String, nullable=True) # Paynow poll URL for status checking
    metadata_json = Column(JSON) # e.g. {"from": "PENDING", "to": "CONFIRMED"}
    created_at = Column(DateTime, server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "public"}
    
    id = Column(Integer, primary_key=True)
    type = Column(String) # PAYMENT_EXCEPTION, SYSTEM_DOWNTIME, VIP_ARRIVAL
    severity = Column(String) # CRITICAL, HIGH, WARNING, INFO
    title = Column(String)
    message = Column(String)
    action_url = Column(String, nullable=True)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

class PaymentEvent(Base):
    __tablename__ = "payment_events"
    __table_args__ = {"schema": "public"}
    
    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey("public.payment_transactions.id"))
    event_type = Column(String) # GATEWAY_CALLBACK, ADMIN_OVERRIDE, RECONCILIATION_MATCH
    raw_data = Column(JSON)
    timestamp = Column(DateTime, server_default=func.now())

class SystemSetting(Base):
    __tablename__ = "system_settings"
    __table_args__ = {"schema": "public"}
    
    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, index=True) # e.g. "START_TIME", "END_TIME", "DEPOSIT_FEE"
    value = Column(String) # Serialized value
    description = Column(String, nullable=True)
    updated_at = Column(DateTime, server_onupdate=func.now())

class SystemHealthLog(Base):
    __tablename__ = "system_health_logs"
    __table_args__ = {"schema": "public"}
    
    id = Column(Integer, primary_key=True)
    service = Column(String) # DATABASE, AUTH, GATEWAY
    status = Column(String) # OPERATIONAL, DEGRADED, DOWN
    latency_ms = Column(Integer)
    error_message = Column(String, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

class SystemAlert(Base):
    __tablename__ = "system_alerts"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String, default="INFO") # INFO, WARNING, CRITICAL
    message = Column(String, nullable=False)
    source = Column(String, nullable=True) # e.g., "DATABASE", "VITE_CLIENT", "PAYNOW_API"
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Integer, default=0) # 0 = active, 1 = resolved
