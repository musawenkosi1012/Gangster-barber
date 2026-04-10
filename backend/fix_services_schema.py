from sqlalchemy import text
from app.db.base import SessionLocal, engine

def fix_schema():
    print("Initiating Schema Synchronization for 'services' table...")
    with engine.connect() as conn:
        # Check for slug column
        try:
            conn.execute(text("ALTER TABLE public.services ADD COLUMN IF NOT EXISTS slug VARCHAR UNIQUE"))
            conn.execute(text("ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description VARCHAR"))
            conn.execute(text("ALTER TABLE public.services ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 40"))
            conn.execute(text("ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_url VARCHAR"))
            conn.execute(text("ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"))
            conn.execute(text("ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category VARCHAR"))
            conn.commit()
            print("SUCCESS: Service Catalog Schema Synchronized.")
        except Exception as e:
            print(f"FAILURE during schema migration: {e}")

if __name__ == "__main__":
    fix_schema()
