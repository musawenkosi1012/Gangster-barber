ALTER TABLE public.payment_transactions
ADD COLUMN IF NOT EXISTS poll_url TEXT;
