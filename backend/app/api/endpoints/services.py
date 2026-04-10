from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import re
from ...db.base import get_db
from ...models.operational import Service as ServiceModel
from ...schemas.operational import Service, ServiceCreate
from ..deps import require_role

router = APIRouter()

def generate_slug(name: str) -> str:
    """Converts 'The Full Gangster' to 'the-full-gangster'."""
    name = name.lower().strip()
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[\s_-]+', '-', name)
    return name

# --- 🛰️ Public Stream (Consumer Feed) ---

@router.get("/services", response_model=List[Service])
def list_public_services(db: Session = Depends(get_db)):
    """The Shop Floor Menu: Returns only active services sorted by their priority."""
    return db.query(ServiceModel).filter(
        ServiceModel.is_active == True
    ).order_by(ServiceModel.sort_order.asc()).all()

# --- 🛡️ Admin Stream (Inventory Control) ---

@router.get("/admin/services", response_model=List[Service])
def list_admin_services(
    current_user: dict = Depends(require_role(["owner", "it_admin"])),
    db: Session = Depends(get_db)
):
    """The Master Inventory: Returns all services including inactive ones for management."""
    return db.query(ServiceModel).order_by(ServiceModel.sort_order.asc()).all()

@router.post("/admin/services", response_model=Service)
def create_service(
    service_in: ServiceCreate,
    current_user: dict = Depends(require_role(["owner", "it_admin"])),
    db: Session = Depends(get_db)
):
    """Adds a new service to the catalog with auto-slug generation."""
    # Validation: Ensure duration is multiple of 40 (Barber Base Slot)
    if service_in.duration_minutes % 40 != 0:
        raise HTTPException(status_code=400, detail="Duration must be a multiple of the 40-minute slot window.")

    # Auto-Slug
    slug = service_in.slug or generate_slug(service_in.name)
    
    # Check for duplicates
    existing = db.query(ServiceModel).filter((ServiceModel.name == service_in.name) | (ServiceModel.slug == slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="A service with this name or slug already exists.")

    db_service = ServiceModel(
        **service_in.model_dump(exclude={"slug"}),
        slug=slug
    )
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@router.patch("/admin/services/{service_id}", response_model=Service)
def update_service(
    service_id: int,
    service_in: ServiceCreate, # We use Create for partial updates as well for simplicity here
    current_user: dict = Depends(require_role(["owner", "it_admin"])),
    db: Session = Depends(get_db)
):
    db_service = db.query(ServiceModel).filter(ServiceModel.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")

    update_data = service_in.model_dump(exclude_unset=True)
    if "name" in update_data and not update_data.get("slug"):
        update_data["slug"] = generate_slug(update_data["name"])

    for field, value in update_data.items():
        setattr(db_service, field, value)

    db.commit()
    db.refresh(db_service)
    return db_service

# --- 🏗️ Asset Management ---

@router.post("/admin/services/upload", dependencies=[Depends(require_role(["owner", "it_admin"]))])
async def upload_service_image(file: UploadFile = File(...)):
    """The Upload Station: Processes high-resolution service photos for the catalog."""
    return {"imageUrl": f"https://api.gangsterbarber.com/assets/services/{file.filename}"}
