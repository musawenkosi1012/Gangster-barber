from datetime import datetime, time, timedelta, date
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from ..models import Booking

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from datetime import timezone
    ZIMBABWE_TZ = timezone(timedelta(hours=2))
else:
    ZIMBABWE_TZ = ZoneInfo("Africa/Harare")

class SchedulerService:
    def __init__(self):
        # Configuration
        self.START_TIME = time(7, 0)
        self.END_TIME = time(20, 0)
        self.SESSION_DURATION = timedelta(minutes=40)
        
        # Professional Break Schedule
        self.BREAK_SCHEDULE = [
            (time(10, 0), time(10, 30)), # Morning Break
            (time(13, 0), time(14, 0)),  # Lunch Break
        ]

    def get_zimbabwe_now(self) -> datetime:
        """Returns the current time in Zimbabwe (Gweru)."""
        return datetime.now(ZIMBABWE_TZ)

    def get_booked_times(self, db: Session, target_date: date) -> List[time]:
        """Returns a list of already booked times for a specific date using ORM."""
        bookings = db.query(Booking).filter(Booking.booking_date == target_date).all()
        return [datetime.strptime(b.slot_time, "%H:%M").time() for b in bookings]

    def allocate_next_available(self, db: Session) -> Optional[Dict[str, any]]:
        """
        Looks for the next available slot within the next 7 days.
        """
        current_dt = self.get_zimbabwe_now()
        
        for i in range(7):
            check_date = (current_dt + timedelta(days=i)).date()
            slots = self.get_all_slots(db, check_date)
            
            for s in slots:
                if s["available"]:
                    if check_date == current_dt.date():
                        slot_time = datetime.strptime(s["time"], "%H:%M").time()
                        if slot_time <= current_dt.time():
                            continue
                            
                    return {"date": check_date, "time": s["time"]}
        return None

    def get_all_slots(self, db: Session, target_date: Optional[date] = None) -> List[dict]:
        """Generates all slots for a date and marks availability."""
        target_date = target_date or self.get_zimbabwe_now().date()
        booked_times = [t.strftime("%H:%M") for t in self.get_booked_times(db, target_date)]
        
        current_time = datetime.combine(target_date, self.START_TIME)
        limit_time = datetime.combine(target_date, self.END_TIME)
        
        slots = []
        while current_time + self.SESSION_DURATION <= limit_time:
            slot_start = current_time.time()
            slot_end = (current_time + self.SESSION_DURATION).time()
            
            in_break = False
            for b_start, b_end in self.BREAK_SCHEDULE:
                if (slot_start < b_end and slot_end > b_start):
                    current_time = datetime.combine(target_date, b_end)
                    in_break = True
                    break
            
            if in_break:
                continue
                
            start_str = slot_start.strftime("%H:%M")
            slots.append({
                "time": start_str,
                "available": start_str not in booked_times
            })
            current_time += self.SESSION_DURATION
            
        return slots

    def is_slot_available(self, db: Session, slot_time_str: str, target_date: Optional[date] = None) -> bool:
        """Checks if a specific slot is available."""
        target_date = target_date or self.get_zimbabwe_now().date()
        slots = self.get_all_slots(db, target_date)
        for s in slots:
            if s["time"] == slot_time_str:
                return s["available"]
        return False

scheduler = SchedulerService()
