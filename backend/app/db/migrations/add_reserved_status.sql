-- Migration: add_reserved_status
-- Adds a TTL column to bookings so RESERVED slots auto-expire.
-- Run once against your Supabase database.

-- 1. Add reserved_until TTL column to bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ NULL;

-- 2. Add paynow_ref column to payment_transactions for initiation-time capture
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS paynow_ref TEXT NULL;

-- 3. Index for fast TTL-cleanup queries (partial — only PENDING rows)
CREATE INDEX IF NOT EXISTS idx_bookings_reserved_until
  ON public.bookings(reserved_until)
  WHERE status = 'PENDING';

-- 4. DB function to cancel expired reservations — called by the /cleanup endpoint
CREATE OR REPLACE FUNCTION public.cancel_expired_reserved_bookings()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  UPDATE public.bookings
  SET status = 'CANCELLED'
  WHERE status = 'PENDING'
    AND reserved_until IS NOT NULL
    AND reserved_until < NOW();

  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;
