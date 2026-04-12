from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...models.operational import Booking, PaymentTransaction
from ...schemas.booking import BookingCreate, BookingUpdate

class BookingRepository:
    """Enterprise Persistence Layer for Barber Session Scheduling."""

    @staticmethod
    def get_by_id(db: Session, booking_id: int) -> Optional[Booking]:
        return db.query(Booking).filter(Booking.id == booking_id).first()

    @staticmethod
    def list_by_user(db: Session, user_id: str) -> List[Booking]:
        return db.query(Booking).filter(Booking.user_id == user_id).order_by(Booking.booking_date.desc()).all()

    @staticmethod
    def list_by_date(db: Session, booking_date: str) -> List[Booking]:
        return db.query(Booking).filter(Booking.booking_date == booking_date).order_by(Booking.slot_time.asc()).all()

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
