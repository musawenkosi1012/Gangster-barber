import sys
import os
sys.path.append(os.getcwd())

from app.db.base import engine
from sqlalchemy import text

def inspect_customers():
    with engine.connect() as conn:
        print("Inspecting 'customers' table...")
        result = conn.execute(text("SELECT * FROM public.customers LIMIT 1;"))
        columns = result.keys()
        print(f"Columns: {list(columns)}")
        
        row = result.fetchone()
        if row:
             print(f"Sample Row: {row}")
        else:
             print("No customers found in DB.")

if __name__ == "__main__":
    inspect_customers()
