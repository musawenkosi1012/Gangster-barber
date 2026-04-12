import sys
import os
sys.path.append(os.getcwd())

from app.db.base import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Migrating...")
        conn.execute(text("ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS metadata_json JSON;"))
        conn.commit()
        print("Success: metadata_json ADDED")

if __name__ == "__main__":
    migrate()
