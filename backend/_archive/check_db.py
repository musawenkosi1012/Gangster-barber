from app.db.base import SessionLocal
from app.models.booking import Booking

db = SessionLocal()
try:
    bookings = db.query(Booking).all()
    print(f"Total bookings: {len(bookings)}")
    for b in bookings:
        print(f"ID: {b.id}, Date: {b.booking_date}, Slot: '{b.slot_time}', User: {b.user_id}")
finally:
    db.close()
