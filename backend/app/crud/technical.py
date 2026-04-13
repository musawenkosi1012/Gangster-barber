from typing import List, Optional
from sqlalchemy.orm import Session
from ..models.technical import AuditLog, SystemAlert

class TechnicalRepository:
    """Enterprise Persistence Layer for Audit Logs and System Health Telemetry."""

    @staticmethod
    def list_audit_logs(db: Session, limit: int = 50, offset: int = 0) -> List[AuditLog]:
        return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def count_critical_alerts(db: Session) -> int:
        return db.query(SystemAlert).filter(
            SystemAlert.level == "CRITICAL", 
            SystemAlert.resolved == 0
        ).count()

    @staticmethod
    def create_system_alert(db: Session, level: str, message: str, source: str) -> SystemAlert:
        alert = SystemAlert(level=level, message=message, source=source)
        db.add(alert)
        return alert

technical_crud = TechnicalRepository()
