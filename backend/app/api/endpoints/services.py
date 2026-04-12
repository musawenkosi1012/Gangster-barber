from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import re
import shutil
import os
from ...db.base import get_db
from ...models.operational import Service as ServiceModel, ServiceImage as ServiceImageModel
from ...schemas.operational import Service, ServiceCreate
from ..deps import require_role
from ...services.storage import storage_service

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
    return db.query(ServiceModel).options(joinedload(ServiceModel.images)).filter(
        ServiceModel.is_active == True
    ).order_by(ServiceModel.sort_order.asc()).all()

# --- 🛡️ Admin Stream (Inventory Control) ---

@router.get("/admin/services", response_model=List[Service])
def list_admin_services(
    current_user: dict = Depends(require_role(["admin", "it_admin", "owner"])),
    db: Session = Depends(get_db)
):
    """The Master Inventory: Returns all services including inactive ones for management."""
    return db.query(ServiceModel).options(joinedload(ServiceModel.images)).order_by(ServiceModel.sort_order.asc()).all()

@router.post("/admin/services", response_model=Service)
async def create_service_unified(
    name: str = Form(...),
    price: float = Form(...),
    duration_minutes: int = Form(40),
    description: Optional[str] = Form(None),
    is_active: bool = Form(True),
    sort_order: int = Form(0),
    category: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    current_user: dict = Depends(require_role(["admin", "it_admin", "owner"])),
    db: Session = Depends(get_db)
):
    """
    Unified Catalog Ingestion: Commits both metadata and assets in a single transaction.
    Enforces the 2026 'Atomic Entry' principle.
    """
    if duration_minutes % 40 != 0:
        raise HTTPException(status_code=400, detail="Duration must be multiple of 40")

    slug = generate_slug(name)
    existing = db.query(ServiceModel).filter((ServiceModel.name == name) | (ServiceModel.slug == slug)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Service exists")

    try:
        db_service = ServiceModel(
            name=name, price=price, duration_minutes=duration_minutes,
            description=description, is_active=is_active, sort_order=sort_order,
            category=category, slug=slug
        )
        db.add(db_service)
        db.flush() # Get ID for assets

        # Image Processing logic (Atomic via Storage Service)
        if files:
            for file in files:
                # Security Guard: Validation (Mime/Size)
                if not file.content_type.startswith("image/"):
                    raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")
                
                # Cloud Migration: Atomic Transfer to remote storage
                image_url = await storage_service.upload_file(file, folder=f"services/{db_service.id}")
                db.add(ServiceImageModel(image_path=image_url, service_id=db_service.id))

        db.commit()
        db.refresh(db_service)
        return db_service
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"System collision during catalog ingestion: {str(e)}")

@router.patch("/admin/services/{service_id}", response_model=Service)
async def update_service_unified(
    service_id: int,
    name: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    duration_minutes: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    sort_order: Optional[int] = Form(None),
    category: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    current_user: dict = Depends(require_role(["admin", "it_admin", "owner"])),
    db: Session = Depends(get_db)
):
    db_service = db.query(ServiceModel).filter(ServiceModel.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")

    try:
        if name:
            db_service.name = name
            db_service.slug = generate_slug(name)
        if price is not None: db_service.price = price
        if duration_minutes is not None: db_service.duration_minutes = duration_minutes
        if description is not None: db_service.description = description
        if is_active is not None: db_service.is_active = is_active
        if sort_order is not None: db_service.sort_order = sort_order
        if category is not None: db_service.category = category

        if files:
            for file in files:
                # Security Guard: Validation
                if not file.content_type.startswith("image/"):
                    continue # Skip non-images
                
                image_url = await storage_service.upload_file(file, folder=f"services/{service_id}")
                db.add(ServiceImageModel(image_path=image_url, service_id=service_id))

        db.commit()
        db.refresh(db_service)
        return db_service
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Atomic update failed: {str(e)}")

# --- 🏗️ Asset Management ---

@router.post("/admin/services/{service_id}/upload-images", dependencies=[Depends(require_role(["admin", "it_admin", "owner"]))])
async def upload_multiple_service_images(
    service_id: int, 
    files: List[UploadFile] = File(...), 
    db: Session = Depends(get_db)
):
    """
    Tactical Multi-Asset Ingestion: Processes high-resolution service photos for the catalog.
    Enforces 'Antigravity' by keeping the existing core relational integrity.
    """
    service = db.query(ServiceModel).filter(ServiceModel.id == service_id).first()
    if not service:
         raise HTTPException(status_code=404, detail="Service not found")

    try:
        saved_images = []
        for file in files:
            if not file.content_type.startswith("image/"):
                continue
                
            image_url = await storage_service.upload_file(file, folder=f"services/{service_id}")
            new_image = ServiceImageModel(image_path=image_url, service_id=service_id)
            db.add(new_image)
            saved_images.append(new_image)
            
        db.commit()
        return {
            "status": "success", 
            "images_uploaded": len(saved_images),
            "service_id": service_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Multi-asset ingestion failed: {str(e)}")

@router.delete("/admin/services/images/{image_id}", dependencies=[Depends(require_role(["admin", "it_admin", "owner"]))])
def delete_service_image(image_id: int, db: Session = Depends(get_db)):
    """Asset Recall: Removes a specific image from the portfolio registry."""
    img = db.query(ServiceImageModel).filter(ServiceImageModel.id == image_id).first()
    if not img:
        return {"status": "error", "message": "Asset not found"} # Silent fail for idempotent logic
    
    try:
        db.delete(img)
        db.commit()
        return {"status": "success", "message": "Asset decommissioned"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to decommission asset")
