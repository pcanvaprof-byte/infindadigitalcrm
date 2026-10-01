-- ============================================================
-- Fix: allow service_role to insert prospect_touchpoints
-- Needed by the external dispatch API (/api/public/v1/dispatch/*)
-- ============================================================

-- By default, Supabase service_role bypasses RLS.
-- This migration is only needed if your project has
-- "Enforce RLS for service_role" enabled on this table.

-- Run this check in Supabase SQL Editor first:
-- SELECT relforcerowsecurity
-- FROM pg_class WHERE relname = 'prospect_touchpoints';
-- If the result is TRUE, apply Option B below.

-- Option B: explicit service_role INSERT policy
-- Uncomment if the check above returns TRUE.

/*
DROP POLICY IF EXISTS "service_role can insert touchpoints"
  ON public.prospect_touchpoints;

CREATE POLICY "service_role can insert touchpoints"
  ON public.prospect_touchpoints
  FOR INSERT
  TO service_role
  WITH CHECK (true);
*/
