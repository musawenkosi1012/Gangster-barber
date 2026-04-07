from datetime import datetime, time, timedelta
from typing import List, Optional
from ..db.base import db

class SchedulerService:
    def __init__(self):
        # Professional Break Schedule
        self.MORNING_BREAK = (time(10, 0), time(10, 30))
        self.LUNCH_BREAK = (time(13, 0), time(14, 0))
        self.START_TIME = time(7, 0)
        self.END_TIME = time(20, 0)
        self.SESSION_DURATION = timedelta(minutes=40)

    def get_booked_times(self) -> List[time]:
        bookings = db.load()
        return [datetime.strptime(b["slot_time"], "%H:%M").time() for b in bookings]

    def allocate_next_slot(self) -> Optional[str]:
        slots = self.get_all_slots()
        available_slots = [s["time"] for s in slots if s["available"]]
        return available_slots[0] if available_slots else None

    def get_all_slots(self) -> List[dict]:
        booked_times = [t.strftime("%H:%M") for t in self.get_booked_times()]
        current_time = datetime.combine(datetime.today(), self.START_TIME)
        limit_time = datetime.combine(datetime.today(), self.END_TIME)
        
        slots = []
        while current_time + self.SESSION_DURATION <= limit_time:
            slot_start = current_time.time()
            slot_end = (current_time + self.SESSION_DURATION).time()
            start_str = slot_start.strftime("%H:%M")

            # Check Breaks
            if (slot_start < self.MORNING_BREAK[1] and slot_end > self.MORNING_BREAK[0]):
                current_time = datetime.combine(datetime.today(), self.MORNING_BREAK[1])
                continue

            if (slot_start < self.LUNCH_BREAK[1] and slot_end > self.LUNCH_BREAK[0]):
                current_time = datetime.combine(datetime.today(), self.LUNCH_BREAK[1])
                continue

            slots.append({
                "time": start_str,
                "available": start_str not in booked_times
            })
            current_time += self.SESSION_DURATION
            
        return slots

    def is_slot_available(self, slot_time_str: str) -> bool:
        slots = self.get_all_slots()
        for s in slots:
            if s["time"] == slot_time_str:
                return s["available"]
        return False

scheduler = SchedulerService()
