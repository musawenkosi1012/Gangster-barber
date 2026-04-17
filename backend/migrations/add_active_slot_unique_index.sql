-- ─────────────────────────────────────────────────────────────────────────────
-- Enforce slot uniqueness at the database level.
--
-- A full UniqueConstraint on (booking_date, slot_time) would prevent
-- re-booking a slot after a cancellation — the CANCELLED row would collide.
-- A partial index restricted to non-cancelled statuses handles this correctly:
--   • Two CONFIRMED/PENDING/etc rows for the same slot → IntegrityError ✓
--   • A new CONFIRMED row for a previously-CANCELLED slot  → allowed ✓
--
-- If the old full constraint '_date_slot_uc' was ever applied, drop it first.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the old full constraint if it exists (no-op if it was never created).
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS _date_slot_uc;

-- Partial unique index — excludes CANCELLED rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot
    ON public.bookings (booking_date, slot_time)
    WHERE status NOT IN ('CANCELLED');
