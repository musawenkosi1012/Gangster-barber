from datetime import datetime, time, timedelta, date
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from ..models import Booking, BlockedSlot

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from datetime import timezone
    ZIMBABWE_TZ = timezone(timedelta(hours=2))
else:
    ZIMBABWE_TZ = ZoneInfo("Africa/Harare")

class SchedulerService:
    def __init__(self):
        # Configuration - Now set for High-Performance Continuous Stream
        self.START_TIME = time(5, 0)
        self.END_TIME = time(22, 0)
        self.SESSION_DURATION = timedelta(minutes=40)
        
        # Static Break logic removed in favor of Dynamic Admin Blocking
        self.BREAK_SCHEDULE = []

    def get_zimbabwe_now(self) -> datetime:
        """Returns the current time in Zimbabwe (Gweru)."""
        return datetime.now(ZIMBABWE_TZ)

    def _is_active(self, booking, now: datetime) -> bool:
        """A booking holds a slot only if it is not cancelled/rejected AND
        not an expired PENDING reservation (TTL elapsed)."""
        if booking.status in ("CANCELLED", "REJECTED"):
            return False
        if (
            booking.status == "PENDING"
            and booking.reserved_until is not None
            and booking.reserved_until.replace(tzinfo=None) < now.replace(tzinfo=None)
        ):
            return False  # TTL expired — treat slot as free
        return True

    def get_booked_times(self, db: Session, target_date: date) -> List[time]:
        """Returns a list of actively held times for a specific date.
        Excludes CANCELLED, REJECTED, and TTL-expired PENDING rows."""
        now = self.get_zimbabwe_now()
        bookings = db.query(Booking).filter(
            Booking.booking_date == target_date,
            Booking.status.notin_(["CANCELLED", "REJECTED"])
        ).all()
        blocks = db.query(BlockedSlot).filter(BlockedSlot.date == target_date).all()

        booked_times = []
        # Parse active bookings
        for b in bookings:
            if not self._is_active(b, now):
                continue
            try:
                t = datetime.strptime(b.slot_time, "%H:%M").time()
                booked_times.append(t)
            except ValueError:
                try:
                    t = datetime.strptime(b.slot_time.strip(), "%I:%M %p").time()
                    booked_times.append(t)
                except ValueError:
                    print(f"Warning: Could not parse slot_time '{b.slot_time}'")
        
        # Parse manual blocks
        for block in blocks:
             try:
                t = datetime.strptime(block.slot_time, "%H:%M").time()
                booked_times.append(t)
             except ValueError:
                print(f"Warning: Could not parse block time '{block.slot_time}'")
                
        return booked_times

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
        """Generates all slots for a date and marks availability with metadata."""
        target_date = target_date or self.get_zimbabwe_now().date()
        
        # Fetch status pointers
        bookings = db.query(Booking).filter(Booking.booking_date == target_date).all()
        blocks = db.query(BlockedSlot).filter(BlockedSlot.date == target_date).all()
        
        # Map for O(1) lookups during generation.
        # Ignores CANCELLED, REJECTED, and TTL-expired PENDING rows.
        now = self.get_zimbabwe_now()
        booking_times = {b.slot_time for b in bookings if self._is_active(b, now)}
        block_map = {bl.slot_time: bl for bl in blocks}
        
        current_time = datetime.combine(target_date, self.START_TIME)
        limit_time = datetime.combine(target_date, self.END_TIME)
        
        slots = []
        while current_time + self.SESSION_DURATION <= limit_time:
            slot_start = current_time.time()
            slot_end = (current_time + self.SESSION_DURATION).time()
            start_str = slot_start.strftime("%H:%M")

            # Check Professional Break Schedule
            in_break = False
            for b_start, b_end in self.BREAK_SCHEDULE:
                if (slot_start < b_end and slot_end > b_start):
                    current_time = datetime.combine(target_date, b_end)
                    in_break = True
                    break
            
            if in_break: continue
                
            is_booked = start_str in booking_times
            block_obj = block_map.get(start_str)
            
            slots.append({
                "time": start_str,
                "available": not (is_booked or block_obj),
                "is_blocked": bool(block_obj),
                "block_id": block_obj.id if block_obj else None,
                "block_reason": block_obj.reason if block_obj else None
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
