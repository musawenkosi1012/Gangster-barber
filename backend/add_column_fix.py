from sqlalchemy import text
from app.db.base import engine

def add_status_column():
    print("Attempting to add 'status' column to bookings table...")
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'PENDING'"))
            conn.commit()
            print("Successfully added 'status' column (or it already exists).")
    except Exception as e:
        print(f"Error updating schema: {e}")

if __name__ == "__main__":
    add_status_column()
