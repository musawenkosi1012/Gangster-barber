from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..models.booking import Booking
from ..models.technical import PaymentTransaction, PaymentEvent, AuditLog
from ..schemas.booking import BookingCreate, BookingUpdate, Booking as BookingSchema
from datetime import date, datetime

class BookingRepository:
    """Enterprise Persistence Layer for Barber Session Scheduling."""

    @staticmethod
    def get_by_id(db: Session, booking_id: int) -> Optional[Booking]:
        return db.query(Booking).filter(Booking.id == booking_id).first()

    @staticmethod
    def list_by_user(db: Session, user_id: str) -> List[Booking]:
        return db.query(Booking).filter(Booking.user_id == user_id).order_by(Booking.booking_date.desc()).all()

    @staticmethod
    def list_by_date(db: Session, booking_date: date) -> List[Booking]:
        """
        Returns bookings visible to the barber — CONFIRMED and COMPLETED only.
        PENDING rows (legacy) and CANCELLED rows are excluded.
        Draft bookings never reach the DB, so they are never shown here.
        """
        return (
            db.query(Booking)
            .filter(
                Booking.booking_date == booking_date,
                Booking.status.in_(["CONFIRMED", "COMPLETED", "VERIFYING", "NO_SHOW"]),
            )
            .order_by(Booking.slot_time.asc())
            .all()
        )

    @staticmethod
    def get_next_arrival(db: Session, target_date: date, min_time: str) -> Optional[Booking]:
        return db.query(Booking).filter(
            Booking.booking_date == target_date,
            Booking.slot_time > min_time,
            Booking.status == "CONFIRMED"
        ).order_by(Booking.slot_time.asc()).first()

    @staticmethod
    def get_manual_review_transactions(db: Session) -> List[PaymentTransaction]:
        return db.query(PaymentTransaction).filter(
            PaymentTransaction.status == "manual_review"
        ).order_by(PaymentTransaction.created_at.asc()).all()

    @staticmethod
    def list_ledger(db: Session, status: Optional[str] = None, search: Optional[str] = None) -> List[PaymentTransaction]:
        query = db.query(PaymentTransaction)
        if status:
            query = query.filter(PaymentTransaction.status == status)
        if search:
            query = query.filter(PaymentTransaction.provider_ref.ilike(f"%{search}%"))
        return query.order_by(PaymentTransaction.created_at.desc()).all()

    @staticmethod
    def create_payment_event(db: Session, tx_id: int, event_type: str, raw_data: dict) -> PaymentEvent:
        event = PaymentEvent(
            transaction_id=tx_id,
            event_type=event_type,
            raw_data=raw_data
        )
        db.add(event)
        return event

    @staticmethod
    def create_audit(db: Session, actor_id: str, role: str, action: str, resource_id: str, metadata: dict) -> AuditLog:
        audit = AuditLog(
            actor_id=actor_id,
            role=role,
            action=action,
            resource_id=resource_id,
            metadata_json=metadata
        )
        db.add(audit)
        return audit

    @staticmethod
    def list_by_name(db: Session, name: str) -> List[Booking]:
        return db.query(Booking).filter(
            Booking.name == name
        ).order_by(Booking.booking_date.desc()).all()

    @staticmethod
    def get_transaction_by_id(db: Session, tx_id: int) -> Optional[PaymentTransaction]:
        return db.query(PaymentTransaction).filter(PaymentTransaction.id == tx_id).first()

    @staticmethod
    def list_all(db: Session) -> List[Booking]:
        return db.query(Booking).order_by(Booking.booking_date.desc()).all()

    @staticmethod
    def get_pending_transaction(db: Session, booking_id: int) -> Optional[PaymentTransaction]:
        return db.query(PaymentTransaction).filter(
            PaymentTransaction.booking_id == booking_id,
            PaymentTransaction.status == "pending"
        ).first()

    @staticmethod
    def get_latest_transaction(db: Session, booking_id: int) -> Optional[PaymentTransaction]:
        return db.query(PaymentTransaction).filter(
            PaymentTransaction.booking_id == booking_id
        ).order_by(PaymentTransaction.id.desc()).first()

    @staticmethod
    def check_conflict(db: Session, booking_date: str, slot_time: str, exclude_id: Optional[int] = None) -> bool:
        query = db.query(Booking).filter(
            Booking.booking_date == booking_date,
            Booking.slot_time == slot_time
        )
        if exclude_id:
            query = query.filter(Booking.id != exclude_id)
        return query.first() is not None

booking_crud = BookingRepository()
