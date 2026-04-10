from sqlalchemy import text
from app.db.base import engine

def migrate():
    print("Connecting to database...")
    with engine.connect() as conn:
        print("Adding 'status' column to 'bookings' table...")
        try:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN status VARCHAR DEFAULT 'PENDING'"))
            conn.commit()
            print("Successfully added 'status' column.")
        except Exception as e:
            print(f"Error adding column: {e}")
            if "already exists" in str(e).lower():
                print("Column already exists, proceeding.")
            else:
                raise e

if __name__ == "__main__":
    migrate()
