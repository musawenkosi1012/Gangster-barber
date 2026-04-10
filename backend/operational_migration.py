from sqlalchemy import text
from app.db.base import engine, Base
from app.models.operational import Service, BlockedSlot
from app.models.booking import Booking

def run_migrations():
    print("Initializing Operational Command Schema...")
    try:
        # 1. Update existing Booking table
        with engine.connect() as conn:
            print("Checking/Updating 'bookings' table...")
            conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT"))
            conn.commit()
            print("DONE: Bookings table updated.")

        # 2. Create new tables if they don't exist
        print("Creating 'services' and 'blocked_slots' tables...")
        Base.metadata.create_all(bind=engine)
        print("DONE: Operational tables created.")
        
        # 3. Seed initial services if empty
        with engine.connect() as conn:
            res = conn.execute(text("SELECT COUNT(*) FROM services")).scalar()
            if res == 0:
                print("Seeding initial services...")
                services = [
                    ("Taper Fade", 5, 40, "Cuts"),
                    ("Lineup & Shape-Up", 4, 40, "Cuts"),
                    ("The Full Gangster", 8, 40, "Elite"),
                    ("Beard Sculpt", 4, 40, "Beard")
                ]
                for name, price, duration, cat in services:
                    conn.execute(text(f"INSERT INTO services (name, price, duration_minutes, category) VALUES ('{name}', {price}, {duration}, '{cat}')"))
                conn.commit()
                print("DONE: Initial services seeded.")

        print("Database is ready for Operational Command.")
        
    except Exception as e:
        print(f"ERROR: Migration failed: {e}")

if __name__ == "__main__":
    run_migrations()
