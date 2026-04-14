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
    def upsert_from_booking(db: Session, clerk_id: str, name: str) -> Customer:
        """
        Ensures a Customer record exists for a booker.
        Looks up by clerk_id first, then falls back to name.
        Updates booking_count and last_visit_at on every call.
        """
        from datetime import datetime, timezone
        customer = db.query(Customer).filter(Customer.clerk_id == clerk_id).first()
        if not customer:
            customer = Customer(
                clerk_id=clerk_id,
                full_name=name,
                status="active",
                booking_count=1,
                last_visit_at=datetime.now(timezone.utc),
            )
            db.add(customer)
        else:
            customer.booking_count = (customer.booking_count or 0) + 1
            customer.last_visit_at = datetime.now(timezone.utc)
            if name and customer.full_name != name:
                customer.full_name = name
        return customer

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
