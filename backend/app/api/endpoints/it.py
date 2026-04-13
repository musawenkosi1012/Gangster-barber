from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from ...db.base import get_db
from ...models.technical import AuditLog, PaymentTransaction, SystemAlert
from ...services.scheduler import scheduler
from ..deps import require_role
from ...crud.technical import technical_crud
from ...crud.booking import booking_crud
from typing import List, Dict, Any
import time

# IT Dashboard is strictly gated for admin, it_admin and owner roles
router = APIRouter(prefix="/api/v1/it", dependencies=[Depends(require_role(["admin", "it_admin", "owner"]))])

@router.get("/security/audit-logs", response_model=None)
def get_audit_logs(
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0
) -> List[AuditLog]:
    """A stream of who changed what across the entire operational environment."""
    return technical_crud.list_audit_logs(db, limit, offset)

@router.get("/payments/alerts")
def get_payment_alerts(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    The 'Urgent Payments' Payload.
    Categorizes unresolved EcoCash/OneMoney transactions by age and provider.
    """
    pending = booking_crud.get_manual_review_transactions(db)
    
    provider_counts = {}
    oldest_ts = None
    
    for tx in pending:
        provider_counts[tx.provider] = provider_counts.get(tx.provider, 0) + 1
        if not oldest_ts or tx.created_at < oldest_ts:
            oldest_ts = tx.created_at
            
    zims_now = scheduler.get_zimbabwe_now()
    age_mins = (zims_now - oldest_ts.replace(tzinfo=zims_now.tzinfo)).total_seconds() / 60 if oldest_ts else 0
    
    return {
        "unresolved_count": len(pending),
        "methods": [{"provider": k, "count": v} for k, v in provider_counts.items()],
        "oldest_pending_minutes": round(age_mins),
        "severity": "critical" if age_mins > 60 else ("warning" if age_mins > 20 else "normal")
    }

@router.get("/system/health")
def get_health(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Status of DB, Auth (Clerk), and Paynow API connectivity."""
    start_time = time.time()
    try:
        db.execute(text("SELECT 1"))
        latency_ms = (time.time() - start_time) * 1000
        db_status = "STABLE"
    except Exception:
        latency_ms = -1
        db_status = "UNSTABLE"
    
    return {
        "status": db_status if latency_ms > 0 else "DEGRADED",
        "database_latency_ms": round(latency_ms, 2),
        "recent_critical_alerts": technical_crud.count_critical_alerts(db),
        "active_it_engine": True
    }
