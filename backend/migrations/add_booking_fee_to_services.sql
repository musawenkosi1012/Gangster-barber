-- Migration: add booking_fee column to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS booking_fee FLOAT DEFAULT 0.0;
