from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional, Dict
import re
import shutil
import os
from ...db.base import get_db
from ...models.operational import Service as ServiceModel, ServiceImage as ServiceImageModel
from ...schemas.operational import Service, ServiceCreate
from ..deps import require_role
from ...services.storage import storage_service
from ...crud.service import service_crud

router = APIRouter()

def generate_slug(name: str) -> str:
    """Converts 'The Full Gangster' to 'the-full-gangster'."""
    name = name.lower().strip()
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[\s_-]+', '-', name)
    return name

# --- 🛰️ Public Stream (Consumer Feed) ---

@router.get("/services", response_model=List[Service])
def list_public_services(db: Session = Depends(get_db)) -> List[ServiceModel]:
    """The Shop Floor Menu: Returns only active services sorted by their priority."""
    return service_crud.list_active(db)

# --- 🛡️ Admin Stream (Inventory Control) ---

@router.get("/admin/services", response_model=List[Service])
def list_admin_services(
    current_user: dict = Depends(require_role(["admin", "it_admin", "owner"])),
    db: Session = Depends(get_db)
) -> List[ServiceModel]:
    """The Master Inventory: Returns all services including inactive ones for management."""
    return service_crud.list_all(db)

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
    existing = service_crud.get_by_slug_or_name(db, name, slug)
    if existing:
        raise HTTPException(status_code=400, detail="Service exists")

    try:
        db_service = service_crud.create_service(
            db,
            name=name, price=price, duration_minutes=duration_minutes,
            description=description, is_active=is_active, sort_order=sort_order,
            category=category, slug=slug
        )
        db.flush() # Get ID for assets

        # Image Processing logic (Atomic via Storage Service)
        if files:
            for file in files:
                # Security Guard: Validation (Mime/Size)
                if not file.content_type.startswith("image/"):
                    raise HTTPException(status_code=400, detail=f"File {file.filename} is not an image")
                
                # Payload Policing: 5MB limit
                if file.size > 5 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail=f"Asset {file.filename} exceeds 5MB limit")
                
                # Cloud Migration: Atomic Transfer to remote storage
                image_url = await storage_service.upload_file(file, folder=f"services/{db_service.id}")
                service_crud.create_image(db, image_path=image_url, service_id=db_service.id)

        try:
            db.commit()
            db.refresh(db_service)
        except Exception:
            db.rollback()
            raise
        return db_service
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"System collision during catalog ingestion: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Logic collision: {str(e)}")

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
    db_service = service_crud.get_by_id(db, service_id)
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
                
                # Payload Policing: 5MB limit
                if file.size > 5 * 1024 * 1024:
                    print(f"SECURITY: Blocked oversized asset {file.filename}")
                    continue
                
                image_url = await storage_service.upload_file(file, folder=f"services/{service_id}")
                service_crud.create_image(db, image_path=image_url, service_id=service_id)

        try:
            db.commit()
            db.refresh(db_service)
        except Exception:
            db.rollback()
            raise
        return db_service
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Atomic update failure: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Logic update failure: {str(e)}")

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
    service = service_crud.get_by_id(db, service_id)
    if not service:
         raise HTTPException(status_code=404, detail="Service not found")

    try:
        saved_images = []
        for file in files:
            if not file.content_type.startswith("image/"):
                continue
                
            # Payload Policing: 5MB limit
            if file.size > 5 * 1024 * 1024:
                raise HTTPException(status_code=413, detail=f"Oversized asset detected: {file.filename}")
                
            image_url = await storage_service.upload_file(file, folder=f"services/{service_id}")
            new_image = service_crud.create_image(db, image_path=image_url, service_id=service_id)
            saved_images.append(new_image)
            
        try:
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {
            "status": "success", 
            "images_uploaded": len(saved_images),
            "service_id": service_id
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Multi-asset ingestion failed: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Asset logic failed: {str(e)}")

@router.delete("/admin/services/{service_id}", dependencies=[Depends(require_role(["admin", "it_admin", "owner"]))])
def delete_service(service_id: int, db: Session = Depends(get_db)) -> Dict[str, str]:
    """Decommission a service from the inventory."""
    svc = db.query(ServiceModel).filter(ServiceModel.id == service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    try:
        db.delete(svc)
        db.commit()
        return {"status": "success", "message": "Service decommissioned"}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to decommission service")

@router.delete("/admin/services/images/{image_id}", dependencies=[Depends(require_role(["admin", "it_admin", "owner"]))])
def delete_service_image(image_id: int, db: Session = Depends(get_db)) -> Dict[str, str]:
    """Asset Recall: Removes a specific image from the portfolio registry."""
    img = service_crud.get_image_by_id(db, image_id)
    if not img:
        return {"status": "error", "message": "Asset not found"} # Silent fail for idempotent logic
    
    try:
        service_crud.delete_image(db, img)
        db.commit()
        return {"status": "success", "message": "Asset decommissioned"}
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to decommission asset")
