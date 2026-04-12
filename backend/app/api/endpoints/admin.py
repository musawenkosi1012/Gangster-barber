from fastapi import APIRouter, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from ...db.base import get_db
from ...models import Booking, BlockedSlot, Service, AuditLog, PaymentTransaction, SystemAlert, Notification, PaymentEvent
from sqlalchemy.exc import SQLAlchemyError
from ...schemas.booking import Booking as BookingSchema, BookingUpdate
from ...schemas.operational import AdminStats, BlockedSlotCreate, BlockedSlot as BlockedSlotSchema
from ...crud.booking import booking_crud
from ...crud.service import service_crud
from ...crud.operational import operational_crud
from ...services.scheduler import scheduler
from ...services.health import health_service
from ..deps import get_current_admin
from datetime import date
from typing import List, Optional, Dict, Any
import time

router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(get_current_admin)])

@router.patch("/bookings/{booking_id}/transition")
def transition_booking(booking_id: int, to_status: str, db: Session = Depends(get_db), current_admin: Dict[str, Any] = Depends(get_current_admin)) -> Dict[str, Any]:
    """Lifecycle controller: Moves a booking through its operational states."""
    booking = booking_crud.get_by_id(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    old_status = booking.status
    booking.status = to_status.upper()
    
    # Audit log for IT forensics
    try:
        booking_crud.create_audit(
            db,
            actor_id=current_admin.get("sub", "unknown"),
            role=current_admin.get("metadata", {}).get("role", "admin"),
            action="LIFECYCLE_TRANSITION",
            resource_id=str(booking_id),
            metadata={"from": old_status, "to": booking.status}
        )
        db.commit()
        return {"message": "Transition successful", "status": booking.status}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Safe-Commit Failure: Lifecycle state inconsistent")

@router.get("/dashboard/bootstrap")
async def admin_dashboard_bootstrap(
    response: Response,
    db: Session = Depends(get_db), 
    current_admin: Dict[str, Any] = Depends(get_current_admin)
):
    """
    The 'Parallel Pulse' Aggregator: Hydrates the Tactical Terminal with concurrent telemetry.
    Executes health probes and BI math in parallel to bypass regional latency bottlenecks.
    """
    start_time = time.perf_counter()
    zims_now = scheduler.get_zimbabwe_now()
    today = zims_now.date()

    # --- 1. BI & KPI CALCULATIONS (Synchronous Block) ---
    today_bookings = booking_crud.list_by_date(db, today)
    services = service_crud.list_all(db)
    price_map = {s.name: s.price for s in services}

    paid_bookings = [b for b in today_bookings if b.status in ["COMPLETED", "CONFIRMED"]]
    total_rev = sum(price_map.get(b.service, 15.0) for b in paid_bookings)

    finished_count = len([b for b in today_bookings if b.status in ["COMPLETED", "NO_SHOW"]])
    no_show_count = len([b for b in today_bookings if b.status == "NO_SHOW"])
    no_show_rate = (no_show_count / finished_count * 100) if finished_count > 0 else 0

    total_slots = len(scheduler.get_all_slots(db, today))
    booked_slots = len(today_bookings)
    daily_load = (booked_slots / total_slots * 100) if total_slots > 0 else 0

    now_time_str = zims_now.strftime("%H:%M")
    next_up = booking_crud.get_next_arrival(db, today, now_time_str)

    # --- 2. PAYMENT ALERTS ---
    pending_txs = booking_crud.get_manual_review_transactions(db)

    # --- 3. HEALTH PROBES (direct await, no create_task for serverless safety) ---
    try:
        integrity = await health_service.record_heartbeat(db)
    except Exception:
        integrity = {
            "database": "unknown", "database_latency_ms": None,
            "auth": "unknown", "auth_latency_ms": None,
            "payments": "no_data", "payments_failures": 0,
            "payments_success_rate": None, "uptime": 100.0,
            "uptime_has_data": False, "cluster": "GB-API-A"
        }
    
    # Performance telemetry
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"

    return {
        "admin_badge": {
            "identity": current_admin.get("first_name", "Staff"),
            "role": current_admin.get("metadata", {}).get("role", "admin"),
            "status": "AUTHORIZED"
        },
        "kpis": {
            "revenue": total_rev,
            "completed_sessions": len([b for b in today_bookings if b.status == "COMPLETED"]),
            "daily_load_pct": round(daily_load, 1),
            "no_show_rate": round(no_show_rate, 1),
            "next_arrival": {
                "name": next_up.name if next_up else "No Active Sessions",
                "service": next_up.service if next_up else "N/A",
                "time": next_up.slot_time if next_up else "—"
            }
        },
        "schedule_preview": [
            {"time": b.slot_time, "customer": b.name, "status": b.status}
            for b in today_bookings[:5]
        ],
        "alerts": {
            "unresolved_count": len(pending_txs),
            "method": pending_txs[0].provider if pending_txs else "None",
            "oldest_pending": pending_txs[0].created_at.strftime("%H:%M") if pending_txs else "—"
        },
        "integrity": integrity
    }

@router.get("/bootstrap")
async def admin_bootstrap_legacy(
    response: Response,
    db: Session = Depends(get_db), 
    current_admin: Dict[str, Any] = Depends(get_current_admin)
):
    """Legacy compatibility bridge: Ensures 2025 terminal clients can still hydrate."""
    return await admin_dashboard_bootstrap(response, db, current_admin)

@router.get("/dashboard/overview")
def get_dashboard_pulse(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Strategic Pulse: High-performance KPI delivery."""
    zims_now = scheduler.get_zimbabwe_now()
    today = zims_now.date()
    bookings = booking_crud.list_by_date(db, today)
    return {"stats": {"revenue": 0, "completed": len(bookings)}} # Simplified for now

@router.get("/bookings/schedule", response_model=List[BookingSchema])
def get_flash_schedule(date: Optional[date] = None, db: Session = Depends(get_db)) -> List[Booking]:
    """Chronological stream of today's slots with full customer and status metadata."""
    date_to_check = date or scheduler.get_zimbabwe_now().date()
    return booking_crud.list_by_date(db, date_to_check)

@router.post("/slots/block", response_model=BlockedSlotSchema)
def block_slot(req: BlockedSlotCreate, db: Session = Depends(get_db)) -> BlockedSlot:
    exists = operational_crud.get_blocked_slot(db, req.date, req.slot_time)
    if exists: raise HTTPException(status_code=400, detail="Slot already blocked")
    try:
        new_block = operational_crud.create_blocked_slot(db, **req.model_dump())
        db.commit()
        db.refresh(new_block)
        return new_block
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database lock failure on slot segment")

@router.get("/notifications/critical")
def get_critical_notifications(db: Session = Depends(get_db)) -> List[Notification]:
    """Operational Signals: Fetches all unresolved high-priority incidents."""
    return operational_crud.list_critical_notifications(db)

@router.post("/notifications/{notif_id}/resolve")
def resolve_notification(notif_id: int, db: Session = Depends(get_db)) -> Dict[str, str]:
    notif = operational_crud.get_notification(db, notif_id)
    if notif:
        try:
            notif.is_resolved = True
            db.commit()
            return {"message": "Resolved"}
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(status_code=500, detail="State persistence failure")
    raise HTTPException(status_code=404, detail="Notification not found")

@router.get("/ledger")
def get_admin_ledger(status: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)) -> List[PaymentTransaction]:
    """The Professional Ledger: Filterable chronological history of all payment attempts."""
    return booking_crud.list_ledger(db, status, search)

@router.post("/ledger/{tx_id}/match")
def match_transaction(tx_id: int, booking_id: int, db: Session = Depends(get_db), current_admin: Dict[str, Any] = Depends(get_current_admin)) -> Dict[str, str]:
    """Manual Reconciliation: Links a floating transaction to a specific customer booking."""
    tx = booking_crud.get_transaction_by_id(db, tx_id)
    booking = booking_crud.get_by_id(db, booking_id)
    
    if not tx or not booking:
        raise HTTPException(status_code=404, detail="Transaction or Booking not found")
        
    # Execution: Sync the states
    tx.status = "completed"
    tx.booking_id = booking_id
    booking.status = "CONFIRMED"
    
    # Audit: Create the event log
    booking_crud.create_payment_event(
        db,
        tx_id=tx_id,
        event_type="RECONCILIATION_MATCH",
        raw_data={"admin": current_admin.get("sub"), "booking_id": booking_id}
    )
    
    # Resolution: Close related notification if exists
    notif = operational_crud.get_payment_exception_notification(db, tx.provider_ref or "")
    if notif:
        notif.is_resolved = True
        
    try:
        db.commit()
        return {"message": "Reconciliation successful"}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Manual reconciliation handshake failed")

@router.delete("/slots/unblock/{block_id}")
def unblock_slot(block_id: int, db: Session = Depends(get_db)) -> Dict[str, str]:
    success = operational_crud.delete_blocked_slot(db, block_id)
    if not success: raise HTTPException(status_code=404, detail="Not found")
    try:
        db.commit()
        return {"message": "Unblocked"}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Resource release protocol failure")
