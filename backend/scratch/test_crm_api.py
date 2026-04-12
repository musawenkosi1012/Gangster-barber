import sys
import os
sys.path.append(os.getcwd())

from app.api.endpoints.crm import list_customers
from app.db.base import SessionLocal
import traceback

def test_api():
    db = SessionLocal()
    try:
        print("Executing list_customers logic...")
        customers = list_customers(db=db)
        print(f"Success: Fetched {len(customers)} customers")
        for c in customers:
             print(f" Customer: {c.full_name} (ID: {c.id})")
    except Exception as e:
        print("CRASH DETECTED:")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_api()
