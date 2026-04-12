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

    db_service = ServiceModel(
        name=name, price=price, duration_minutes=duration_minutes,
        description=description, is_active=is_active, sort_order=sort_order,
        category=category, slug=slug
    )
    db.add(db_service)
    db.flush() # Get ID for assets

    # Image Processing logic (Shared with update)
    if files:
        upload_folder = f"static/uploads/services/{db_service.id}"
        os.makedirs(f"backend/{upload_folder}", exist_ok=True)
        for file in files:
            safe_name = re.sub(r'[^a-zA-Z0-9.-]', '_', file.filename)
            file_path = os.path.join(upload_folder, safe_name)
            with open(f"backend/{file_path}", "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            db.add(ServiceImageModel(image_path=file_path, service_id=db_service.id))

    db.commit()
    db.refresh(db_service)
    return db_service

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
        upload_folder = f"static/uploads/services/{service_id}"
        os.makedirs(f"backend/{upload_folder}", exist_ok=True)
        for file in files:
            safe_name = re.sub(r'[^a-zA-Z0-9.-]', '_', file.filename)
            file_path = os.path.join(upload_folder, safe_name)
            with open(f"backend/{file_path}", "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            db.add(ServiceImageModel(image_path=file_path, service_id=service_id))

    db.commit()
    db.refresh(db_service)
    return db_service

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

    # Asset Directory Partitioning (Local - TODO: Migrate to S3/Cloudinary for 2026 Production)
    upload_folder = f"static/uploads/services/{service_id}"
    os.makedirs(f"backend/{upload_folder}", exist_ok=True)
    
    saved_images = []
    for file in files:
        # Security Guard: Sanitize filenames (Simple version)
        safe_name = re.sub(r'[^a-zA-Z0-9.-]', '_', file.filename)
        file_path = os.path.join(upload_folder, safe_name)
        full_dest = os.path.join("backend", file_path)
        
        # Save file to local filesystem (Atomic transfer)
        with open(full_dest, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Save reference in Database (Persistence Handshake)
        new_image = ServiceImageModel(image_path=file_path, service_id=service_id)
        db.add(new_image)
        saved_images.append(new_image)
        
    db.commit()
    return {
        "status": "success", 
        "images_uploaded": len(saved_images),
        "service_id": service_id
    }

@router.delete("/admin/services/images/{image_id}", dependencies=[Depends(require_role(["admin", "it_admin", "owner"]))])
def delete_service_image(image_id: int, db: Session = Depends(get_db)):
    """Asset Recall: Removes a specific image from the portfolio registry."""
    img = db.query(ServiceImageModel).filter(ServiceImageModel.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Optional: Delete from disk here if desired
    # if os.path.exists(f"backend/{img.image_path}"):
    #     os.remove(f"backend/{img.image_path}")
        
    db.delete(img)
    db.commit()
    return {"status": "success", "message": "Asset decommissioned"}
