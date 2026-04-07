from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime, time, timedelta
from typing import List, Optional
import json
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "bookings.json"

# --- Models ---
class BookingRequest(BaseModel):
    name: str
    service: str
    user_id: str

class SlotAllocation(BaseModel):
    name: str
    service: str
    slot_time: str
    user_id: str

# --- Persistence ---
def load_bookings():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r") as f:
        return json.load(f)

def save_bookings(bookings):
    with open(DB_FILE, "w") as f:
        json.dump(bookings, f)

# --- Allocation Logic ---
def get_next_available_slot():
    bookings = load_bookings()
    booked_times = [datetime.strptime(b["slot_time"], "%H:%M").time() for b in bookings]
    
    # Configuration
    start_time = datetime.combine(datetime.today(), time(7, 0)) # 7 AM
    end_time = datetime.combine(datetime.today(), time(20, 0))   # 8 PM
    duration = timedelta(minutes=40)
    
    morning_break = (time(10, 0), time(10, 30))
    lunch_break = (time(13, 0), time(14, 0))
    
    current_time = start_time
    
    while current_time + duration <= end_time:
        slot_start = current_time.time()
        slot_end = (current_time + duration).time()
        
        # Check if overlaps with break
        overlaps_morning = (slot_start < morning_break[1] and slot_end > morning_break[0])
        overlaps_lunch = (slot_start < lunch_break[1] and slot_end > lunch_break[0])
        
        if overlaps_morning:
            current_time = datetime.combine(datetime.today(), morning_break[1])
            continue
        
        if overlaps_lunch:
            current_time = datetime.combine(datetime.today(), lunch_break[1])
            continue
            
        # Check if slot already booked
        if slot_start in booked_times:
            current_time += duration
            continue
            
        return slot_start.strftime("%H:%M")
    
    return None

@app.get("/")
def read_root():
    return {"message": "Gangster Barber API Active"}

@app.post("/api/book")
def book_session(req: BookingRequest):
    slot = get_next_available_slot()
    
    if not slot:
        raise HTTPException(status_code=400, detail="No more slots available today")
    
    booking = {
        "name": req.name,
        "service": req.service,
        "user_id": req.user_id,
        "slot_time": slot
    }
    
    bookings = load_bookings()
    bookings.append(booking)
    save_bookings(bookings)
    
    print(f"Allocated slot {slot} to {req.name}")
    return booking

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
