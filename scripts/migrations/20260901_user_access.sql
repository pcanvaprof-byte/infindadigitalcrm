-- ============================================================
-- User access control (trial, expiration, password change flow)
-- Run this in the app's Supabase (external) SQL editor.
-- Idempotent: safe to re-run.
-- ============================================================

-- 1) user_access ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  organization_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','suspended')),
  access_type text NOT NULL DEFAULT 'trial' CHECK (access_type IN ('trial','paid','internal')),
  plan_name text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  renewed_at timestamptz,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_access TO authenticated;
GRANT ALL ON public.user_access TO service_role;

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_access_select_self_or_admin ON public.user_access;
CREATE POLICY user_access_select_self_or_admin ON public.user_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(organization_id));

CREATE OR REPLACE FUNCTION public.user_access_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_user_access_updated_at ON public.user_access;
CREATE TRIGGER trg_user_access_updated_at
  BEFORE UPDATE ON public.user_access
  FOR EACH ROW EXECUTE FUNCTION public.user_access_touch_updated_at();

-- 2) user_access_events --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  event text NOT NULL CHECK (event IN (
    'ACCESS_CREATED','ACCESS_RENEWED','ACCESS_EXPIRED',
    'PASSWORD_CHANGED','ACCOUNT_BLOCKED','LOGIN'
  )),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_access_events_user
  ON public.user_access_events(user_id, created_at DESC);

GRANT SELECT ON public.user_access_events TO authenticated;
GRANT ALL ON public.user_access_events TO service_role;

ALTER TABLE public.user_access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_access_events_select_self_or_admin ON public.user_access_events;
CREATE POLICY user_access_events_select_self_or_admin ON public.user_access_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (organization_id IS NOT NULL AND public.is_org_admin(organization_id)));

-- 3) RPC check_access_status --------------------------------------------
CREATE OR REPLACE FUNCTION public.check_access_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_access;
  v_role text;
  v_is_priv boolean := false;
  v_status text;
  v_days integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status','expired','is_privileged',false);
  END IF;

  v_role := public.current_org_role();
  IF v_role IN ('owner','admin') THEN
    v_is_priv := true;
  END IF;

  SELECT * INTO v_row FROM public.user_access WHERE user_id = v_uid;

  IF v_is_priv THEN
    RETURN jsonb_build_object(
      'status','active',
      'access_type', COALESCE(v_row.access_type,'internal'),
      'plan_name', v_row.plan_name,
      'expires_at', v_row.expires_at,
      'days_remaining', NULL,
      'must_change_password', COALESCE(v_row.must_change_password,false),
      'is_privileged', true
    );
  END IF;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'status','expired', 'access_type', NULL, 'plan_name', NULL,
      'expires_at', NULL, 'days_remaining', 0,
      'must_change_password', false, 'is_privileged', false
    );
  END IF;

  v_status := v_row.status;
  IF v_status = 'active' AND v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    UPDATE public.user_access SET status = 'expired' WHERE id = v_row.id;
    v_status := 'expired';
    INSERT INTO public.user_access_events(user_id, organization_id, event, meta)
    VALUES (v_uid, v_row.organization_id, 'ACCESS_EXPIRED', jsonb_build_object('at', now()));
  END IF;

  v_days := CASE
    WHEN v_row.expires_at IS NULL THEN NULL
    ELSE GREATEST(0, EXTRACT(EPOCH FROM (v_row.expires_at - now()))::int / 86400)
  END;

  RETURN jsonb_build_object(
    'status', v_status,
    'access_type', v_row.access_type,
    'plan_name', v_row.plan_name,
    'expires_at', v_row.expires_at,
    'days_remaining', v_days,
    'must_change_password', v_row.must_change_password,
    'is_privileged', false
  );
END $$;

REVOKE ALL ON FUNCTION public.check_access_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_access_status() TO authenticated;