-- 1. Marcador de org demo
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_organizations_is_demo
  ON public.organizations(is_demo) WHERE is_demo;

-- 2. Log anti-abuso de signup demo (apenas service_role acessa)
CREATE TABLE IF NOT EXISTS public.demo_signups_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_demo_signups_log_ip_time
  ON public.demo_signups_log(ip, created_at DESC);
GRANT ALL ON public.demo_signups_log TO service_role;
ALTER TABLE public.demo_signups_log ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role acessa.

-- 3. check_access_status: contas demo expiram mesmo para owner/admin.
CREATE OR REPLACE FUNCTION public.check_access_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_access;
  v_role text;
  v_is_priv boolean := false;
  v_status text;
  v_days integer;
  v_is_demo boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status','expired','is_privileged',false);
  END IF;

  v_role := public.current_org_role();
  IF v_role IN ('owner','admin') THEN
    v_is_priv := true;
  END IF;

  SELECT * INTO v_row FROM public.user_access WHERE user_id = v_uid;
  v_is_demo := COALESCE(v_row.access_type, '') = 'demo';

  -- Papéis privilegiados NÃO-demo continuam sem expiração (comportamento antigo).
  IF v_is_priv AND NOT v_is_demo THEN
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

  -- Não privilegiado sem registro => tratar como expirado.
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object(
      'status','expired',
      'access_type', NULL,
      'plan_name', NULL,
      'expires_at', NULL,
      'days_remaining', 0,
      'must_change_password', false,
      'is_privileged', false
    );
  END IF;

  v_status := v_row.status;
  IF v_status = 'active' AND v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    UPDATE public.user_access SET status = 'expired' WHERE id = v_row.id;
    v_status := 'expired';
    INSERT INTO public.user_access_events(user_id, organization_id, event, meta)
    VALUES (v_uid, v_row.organization_id, 'ACCESS_EXPIRED', jsonb_build_object('at', now(), 'access_type', v_row.access_type));
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
    -- Demo NUNCA é privilegiado (força re-check de expiração no cliente também)
    'is_privileged', (v_is_priv AND NOT v_is_demo)
  );
END $function$;

NOTIFY pgrst, 'reload schema';