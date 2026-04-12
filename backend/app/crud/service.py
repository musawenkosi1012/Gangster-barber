from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from ...models.operational import Service, ServiceImage

class ServiceRepository:
    """Enterprise Persistence Layer for Grooming Catalog Management."""

    @staticmethod
    def get_by_id(db: Session, service_id: int) -> Optional[Service]:
        return db.query(Service).filter(Service.id == service_id).first()

    @staticmethod
    def get_by_slug_or_name(db: Session, name: str, slug: str) -> Optional[Service]:
        return db.query(Service).filter((Service.name == name) | (Service.slug == slug)).first()

    @staticmethod
    def list_active(db: Session) -> List[Service]:
        return db.query(Service).options(joinedload(Service.images)).filter(
            Service.is_active == True
        ).order_by(Service.sort_order.asc()).all()

    @staticmethod
    def list_all(db: Session) -> List[Service]:
        return db.query(Service).options(joinedload(Service.images)).order_by(Service.sort_order.asc()).all()

    @staticmethod
    def get_image_by_id(db: Session, image_id: int) -> Optional[ServiceImage]:
        return db.query(ServiceImage).filter(ServiceImage.id == image_id).first()

service_crud = ServiceRepository()
