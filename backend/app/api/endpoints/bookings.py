from fastapi import APIRouter, HTTPException
from ...schemas.booking import BookingCreate, Booking
from ...services.scheduler import scheduler
from ...db.base import db

router = APIRouter()

@router.post("/", response_model=Booking)
def create_booking(req: BookingCreate):
    if req.slot_time:
        # Custom booking: verify availability
        if not scheduler.is_slot_available(req.slot_time):
             raise HTTPException(status_code=400, detail="Requested slot is not available")
        slot = req.slot_time
    else:
        # Automatic booking: allocate next available
        slot = scheduler.allocate_next_slot()
    
    if not slot:
        raise HTTPException(status_code=400, detail="No more slots available today")
    
    booking = {
        "name": req.name,
        "service": req.service,
        "user_id": req.user_id,
        "slot_time": slot
    }
    
    # Save to persistent storage
    bookings = db.load()
    bookings.append(booking)
    db.save(bookings)
    
    return booking

@router.get("/slots")
def get_available_slots():
    return scheduler.get_all_slots()

@router.get("/")
def list_bookings():
    return db.load()

@router.get("/user/{user_id}")
def get_user_bookings(user_id: str):
    return db.get_by_user_id(user_id)
