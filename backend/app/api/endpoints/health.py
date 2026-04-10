from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ...db.base import get_db
from ...services.health import health_service
from ..deps import require_role
from typing import Dict, Any

router = APIRouter(prefix="/api/v1/health", dependencies=[Depends(require_role(["it_admin", "owner"]))])

@router.get("/integrity")
async def get_measured_integrity(db: Session = Depends(get_db)):
    """The 'Hard Truth' API: Returns measured latency, failure rates, and calculated uptime."""
    # Perform the heartbeat and persist to system_health_logs
    telemetry = await health_service.record_heartbeat(db)
    return telemetry
