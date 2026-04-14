-- Migration: add legal consent tracking fields to customers table
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS legal_consent_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legal_version_accepted VARCHAR;

-- Backfill existing customers as having implicitly accepted (no version recorded)
-- Leave NULL so admin can identify pre-compliance signups if needed
