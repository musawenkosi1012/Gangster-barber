from typing import List, Optional
from sqlalchemy.orm import Session
from ...models.operational import BlockedSlot, Notification, SystemAlert
from datetime import date

class OperationalRepository:
    """Registry for Tactical Operational State: Blocks, Notifications, and Alerts."""

    @staticmethod
    def get_blocked_slot(db: Session, target_date: date, slot_time: str) -> Optional[BlockedSlot]:
        return db.query(BlockedSlot).filter(
            BlockedSlot.date == target_date, 
            BlockedSlot.slot_time == slot_time
        ).first()

    @staticmethod
    def create_blocked_slot(db: Session, date: date, slot_time: str, reason: Optional[str] = None) -> BlockedSlot:
        block = BlockedSlot(date=date, slot_time=slot_time, reason=reason)
        db.add(block)
        return block

    @staticmethod
    def delete_blocked_slot(db: Session, block_id: int) -> bool:
        block = db.query(BlockedSlot).filter(BlockedSlot.id == block_id).first()
        if block:
            db.delete(block)
            return True
        return False

    @staticmethod
    def list_critical_notifications(db: Session) -> List[Notification]:
        return db.query(Notification).filter(
            Notification.is_resolved == False
        ).order_by(Notification.created_at.desc()).all()

    @staticmethod
    def get_notification(db: Session, notif_id: int) -> Optional[Notification]:
        return db.query(Notification).filter(Notification.id == notif_id).first()

    @staticmethod
    def get_payment_exception_notification(db: Session, tx_ref: str) -> Optional[Notification]:
        return db.query(Notification).filter(
            Notification.type == "PAYMENT_EXCEPTION",
            Notification.message.contains(tx_ref),
            Notification.is_resolved == False
        ).first()

    @staticmethod
    def delete_notification(db: Session, notif_id: int) -> bool:
        notif = db.query(Notification).filter(Notification.id == notif_id).first()
        if notif:
            db.delete(notif)
            return True
        return False

operational_crud = OperationalRepository()
