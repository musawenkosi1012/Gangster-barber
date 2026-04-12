import sys
import os
sys.path.append(os.getcwd())

from app.api.endpoints.crm import get_customer_detail
from app.db.base import SessionLocal
import traceback

def test_api():
    db = SessionLocal()
    try:
        print("Executing get_customer_detail logic for ID 1...")
        detail = get_customer_detail(customer_id=1, db=db)
        print("Success: Detail fetched")
        print(f"Detail fav service: {detail.get('favorite_service')}")
    except Exception as e:
        print("CRASH DETECTED:")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_api()
