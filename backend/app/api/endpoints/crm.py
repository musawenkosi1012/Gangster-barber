from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from sqlalchemy.exc import SQLAlchemyError
from ...core.limiter import limiter
from ...db.base import get_db
from ...crud.customer import customer_crud
from ...crud.booking import booking_crud
from ...models.crm import Customer as CustomerModel
from ...models.booking import Booking as BookingModel
from ...models.technical import AuditLog
from ...schemas.crm import Customer, CustomerCreate, CustomerUpdate, CustomerDetail
from ..deps import get_current_admin, require_role

router = APIRouter(prefix="/api/v1/admin/customers", tags=["CRM"])

@router.get("/", response_model=List[Customer])
def list_customers(
    search: Optional[str] = None,
    sort_by: str = "last_visit_at", # last_visit_at, total_spend
    db: Session = Depends(get_db),
    current_admin: Dict[str, Any] = Depends(require_role(["admin", "barber", "barber_admin", "owner", "it_admin"]))
) -> List[CustomerModel]:
    """The CRM Search Engine: Returns high-performance filterable customer list with behavioral insights."""
    return customer_crud.search(db, search, sort_by)

@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer_detail(
    customer_id: int, 
    db: Session = Depends(get_db),
    current_admin: Dict[str, Any] = Depends(require_role(["admin", "barber", "barber_admin", "owner", "it_admin"]))
) -> Dict[str, Any]:
    """360-Degree Profile: Aggregates historical metrics, LTV, and reliability scores for a single explorer."""
    customer = customer_crud.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer Profile not found.")

    # Forensic Match: We link bookings via Clerk ID or Name
    history = []
    if customer.clerk_id:
        history = booking_crud.list_by_user(db, customer.clerk_id)
    elif customer.full_name:
        history = booking_crud.list_by_name(db, customer.full_name)

    # Intelligence: Reliability Math
    reliability = 100.0
    booking_count = customer.booking_count or 0
    no_show_count = customer.no_show_count or 0
    if booking_count > 0:
        successful = booking_count - no_show_count
        reliability = (successful / booking_count) * 100

    # Analytics: Historical Resonance
    services_count = {}
    for b in history:
        services_count[b.service] = services_count.get(b.service, 0) + 1
    fav = max(services_count, key=services_count.get) if services_count else "Classic Fade"

    return {
        "id": customer.id,
        "full_name": customer.full_name,
        "phone": customer.phone,
        "email": customer.email,
        "clerk_id": customer.clerk_id,
        "status": customer.status,
        "notes": customer.notes,
        "tags": customer.tags,
        "total_spend": customer.total_spend,
        "booking_count": customer.booking_count,
        "no_show_count": customer.no_show_count,
        "last_visit_at": customer.last_visit_at,
        "created_at": customer.created_at,
        "reliability_pct": round(reliability, 1),
        "history": [{"date": b.booking_date, "slot": b.slot_time, "status": b.status, "service": b.service} for b in history[:20]],
        "favorite_service": fav
    }

@router.patch("/{customer_id}", response_model=Customer)
@limiter.limit("10/minute")
def patch_customer_intelligence(
    customer_id: int,
    data: CustomerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Dict[str, Any] = Depends(require_role(["admin", "barber", "barber_admin", "owner", "it_admin"]))
) -> CustomerModel:
    """Intelligence Update: Modifies behavior notes, status (VIP/Blocked), and tactical tags."""
    customer = customer_crud.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Identity Record not found.")

    old_status = customer.status
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    # Security Log: State mutation audit
    if "status" in update_data and update_data["status"] != old_status:
        booking_crud.create_audit(
            db,
            actor_id=current_admin.get("sub"),
            role=current_admin.get("metadata", {}).get("role", "admin"),
            action="CRM_STATUS_CHANGE",
            resource_id=str(customer_id),
            metadata={"id": customer_id, "from": old_status, "to": update_data["status"]}
        )

    try:
        db.commit()
        db.refresh(customer)
        return customer
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Safe-Commit Failure: Identity record locked")
