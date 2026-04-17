-- ─────────────────────────────────────────────────────────────────────────────
-- payment_drafts — durable store for signed draft tokens awaiting payment.
--
-- Replaces the in-memory _draft_store dict that was used in the paynow service.
-- On Vercel (stateless serverless), the dict was ineffective — different
-- invocations hit different Lambdas, so the webhook rarely found the draft.
--
-- Row lifecycle:
--   1. create_draft writes a row when a booking is staged (draft_token, expires_at)
--   2. confirm_from_draft reads it by paynow_ref and atomically sets consumed_at
--   3. expired rows can be purged by /api/book/cleanup-drafts (cron-safe)
--
-- Idempotency: compare-and-set on consumed_at — a second webhook attempting
-- to consume the same draft will see it already consumed and become a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_drafts (
    paynow_ref    TEXT        PRIMARY KEY,
    draft_token   TEXT        NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    consumed_at   TIMESTAMPTZ NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the periodic expiry sweep
CREATE INDEX IF NOT EXISTS idx_payment_drafts_expires_at
    ON public.payment_drafts (expires_at)
    WHERE consumed_at IS NULL;
