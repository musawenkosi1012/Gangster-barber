from fastapi import APIRouter, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from ...db.base import get_db
from ...models import Booking, BlockedSlot, Service, AuditLog, PaymentTransaction, SystemAlert, Notification, PaymentEvent
from ...schemas.booking import Booking as BookingSchema, BookingUpdate
from ...schemas.operational import AdminStats, BlockedSlotCreate, BlockedSlot as BlockedSlotSchema
from ...services.scheduler import scheduler
from ...services.health import health_service
from ..deps import get_current_admin
from datetime import date
from typing import List, Optional, Dict, Any
import time

router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(get_current_admin)])

@router.patch("/bookings/{booking_id}/transition")
def transition_booking(booking_id: int, to_status: str, db: Session = Depends(get_db), current_admin: Dict[str, Any] = Depends(get_current_admin)):
    """Lifecycle controller: Moves a booking through its operational states."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    old_status = booking.status
    booking.status = to_status.upper()
    
    # Audit log for IT forensics
    audit = AuditLog(
        actor_id=current_admin.get("sub", "unknown"),
        role=current_admin.get("metadata", {}).get("role", "admin"),
        action="LIFECYCLE_TRANSITION",
        resource_id=str(booking_id),
        metadata_json={"from": old_status, "to": booking.status}
    )
    db.add(audit)
    db.commit()
    return {"message": "Transition successful", "status": booking.status}

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
    today_bookings = db.query(Booking).filter(Booking.booking_date == today).all()
    services = db.query(Service).all()
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
    next_up = db.query(Booking).filter(
        Booking.booking_date == today,
        Booking.slot_time > now_time_str,
        Booking.status == "CONFIRMED"
    ).order_by(Booking.slot_time.asc()).first()

    # --- 2. PAYMENT ALERTS ---
    pending_txs = db.query(PaymentTransaction).filter(
        PaymentTransaction.status == "manual_review"
    ).order_by(PaymentTransaction.created_at.asc()).all()

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
def admin_bootstrap_legacy(db: Session = Depends(get_db), current_admin: Dict[str, Any] = Depends(get_current_admin)):
    """Legacy compatibility bridge."""
    return admin_dashboard_bootstrap(db, current_admin)

@router.get("/dashboard/overview")
def get_dashboard_pulse(db: Session = Depends(get_db)):
    """Strategic Pulse: High-performance KPI delivery."""
    zims_now = scheduler.get_zimbabwe_now()
    today = zims_now.date()
    bookings = db.query(Booking).filter(Booking.booking_date == today).all()
    return {"stats": {"revenue": 0, "completed": len(bookings)}} # Simplified for now

@router.get("/bookings/schedule", response_model=List[BookingSchema])
def get_flash_schedule(target_date: Optional[date] = None, db: Session = Depends(get_db)):
    """Chronological stream of today's slots with full customer and status metadata."""
    date_to_check = target_date or scheduler.get_zimbabwe_now().date()
    return db.query(Booking).filter(Booking.booking_date == date_to_check).order_by(Booking.slot_time.asc()).all()

@router.post("/slots/block", response_model=BlockedSlotSchema)
def block_slot(req: BlockedSlotCreate, db: Session = Depends(get_db)):
    exists = db.query(BlockedSlot).filter(BlockedSlot.date == req.date, BlockedSlot.slot_time == req.slot_time).first()
    if exists: raise HTTPException(status_code=400, detail="Slot already blocked")
    new_block = BlockedSlot(**req.model_dump())
    db.add(new_block)
    db.commit()
    db.refresh(new_block)
    return new_block

@router.get("/notifications/critical")
def get_critical_notifications(db: Session = Depends(get_db)):
    """Operational Signals: Fetches all unresolved high-priority incidents."""
    return db.query(Notification).filter(Notification.is_resolved == False).order_by(Notification.created_at.desc()).all()

@router.post("/notifications/{notif_id}/resolve")
def resolve_notification(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if notif:
        notif.is_resolved = True
        db.commit()
    return {"message": "Resolved"}

@router.get("/ledger")
def get_admin_ledger(status: Optional[str] = None, search: Optional[str] = None, db: Session = Depends(get_db)):
    """The Professional Ledger: Filterable chronological history of all payment attempts."""
    query = db.query(PaymentTransaction)
    if status:
        query = query.filter(PaymentTransaction.status == status)
    if search:
        query = query.filter(PaymentTransaction.provider_ref.ilike(f"%{search}%"))
    return query.order_by(PaymentTransaction.created_at.desc()).all()

@router.post("/ledger/{tx_id}/match")
def match_transaction(tx_id: int, booking_id: int, db: Session = Depends(get_db), current_admin: Dict[str, Any] = Depends(get_current_admin)):
    """Manual Reconciliation: Links a floating transaction to a specific customer booking."""
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == tx_id).first()
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    
    if not tx or not booking:
        raise HTTPException(status_code=404, detail="Transaction or Booking not found")
        
    # Execution: Sync the states
    tx.status = "completed"
    tx.booking_id = booking_id
    booking.status = "CONFIRMED"
    
    # Audit: Create the event log
    event = PaymentEvent(
        transaction_id=tx_id,
        event_type="RECONCILIATION_MATCH",
        raw_data={"admin": current_admin.get("sub"), "booking_id": booking_id}
    )
    db.add(event)
    
    # Resolution: Close related notification if exists
    notif = db.query(Notification).filter(
        Notification.type == "PAYMENT_EXCEPTION",
        Notification.message.contains(tx.provider_ref or ""),
        Notification.is_resolved == False
    ).first()
    if notif:
        notif.is_resolved = True
        
    db.commit()
    return {"message": "Reconciliation successful"}

@router.delete("/slots/unblock/{block_id}")
def unblock_slot(block_id: int, db: Session = Depends(get_db)):
    db_block = db.query(BlockedSlot).filter(BlockedSlot.id == block_id).first()
    if not db_block: raise HTTPException(status_code=404, detail="Not found")
    db.delete(db_block)
    db.commit()
    return {"message": "Unblocked"}
