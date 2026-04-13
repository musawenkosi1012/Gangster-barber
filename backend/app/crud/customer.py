from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..models.crm import Customer

class CustomerRepository:
    """Enterprise Persistence Layer for CRM and Identity Insights."""

    @staticmethod
    def get_by_id(db: Session, customer_id: int) -> Optional[Customer]:
        return db.query(Customer).filter(Customer.id == customer_id).first()

    @staticmethod
    def search(db: Session, term: Optional[str] = None, sort_by: str = "last_visit_at") -> List[Customer]:
        query = db.query(Customer)
        if term:
            query = query.filter(or_(
                Customer.full_name.ilike(f"%{term}%"),
                Customer.phone.ilike(f"%{term}%")
            ))

        if sort_by == "total_spend":
            query = query.order_by(Customer.total_spend.desc())
        else:
            query = query.order_by(Customer.last_visit_at.desc().nullslast())
        
        return query.all()

customer_crud = CustomerRepository()
