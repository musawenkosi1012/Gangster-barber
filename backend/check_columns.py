from sqlalchemy import text
from app.db.base import engine

with engine.connect() as conn:
    result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'"))
    print("Columns in bookings table:")
    for row in result:
        print(f" - {row[0]}")
