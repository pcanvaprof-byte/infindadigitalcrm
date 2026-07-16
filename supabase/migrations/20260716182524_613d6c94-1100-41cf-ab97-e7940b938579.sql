
CREATE OR REPLACE VIEW public.v_prospects_private_leaks
WITH (security_invoker = on) AS
SELECT
  p.id                AS prospect_id,
  p.organization_id,
  p.company,
  p.cnpj,
  p.import_id,
  p.imported_by,
  p.created_at,
  p.updated_at,
  p.status,
  p.cadence_step,
  p.cadence_status,
  p.response_status,
  p.last_contact_at,
  p.next_contact_at,
  p.closed_at,
  p.closed_reason
FROM public.prospects p
WHERE p.status          <> 'nao_contatado'
   OR p.cadence_step    <> 0
   OR p.cadence_status  <> 'ativo'
   OR p.response_status <> 'sem_resposta'
   OR p.last_contact_at IS NOT NULL
   OR p.next_contact_at IS NOT NULL
   OR p.closed_at       IS NOT NULL
   OR p.closed_reason   IS NOT NULL;

GRANT SELECT ON public.v_prospects_private_leaks TO authenticated;

CREATE TABLE IF NOT EXISTS public.prospects_private_leak_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  checked_at      timestamptz NOT NULL DEFAULT now(),
  leak_count      integer NOT NULL DEFAULT 0,
  sample_ids      uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status          text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','corrigido','ignorado')),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  notes           text
);

GRANT SELECT, INSERT, UPDATE ON public.prospects_private_leak_alerts TO authenticated;
GRANT ALL ON public.prospects_private_leak_alerts TO service_role;

ALTER TABLE public.prospects_private_leak_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ppla_admin_read ON public.prospects_private_leak_alerts;
CREATE POLICY ppla_admin_read ON public.prospects_private_leak_alerts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.current_org_role() IN ('owner','admin')
  );

DROP POLICY IF EXISTS ppla_admin_write ON public.prospects_private_leak_alerts;
CREATE POLICY ppla_admin_write ON public.prospects_private_leak_alerts
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.current_org_role() IN ('owner','admin')
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public.current_org_role() IN ('owner','admin')
  );

CREATE INDEX IF NOT EXISTS idx_ppla_org_checked
  ON public.prospects_private_leak_alerts(organization_id, checked_at DESC);

CREATE OR REPLACE FUNCTION public.check_prospects_private_leaks(_org uuid DEFAULT NULL)
RETURNS TABLE (out_org uuid, out_leak_count integer, out_alert_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_alert   uuid;
  v_count   integer;
  v_samples uuid[];
BEGIN
  FOR r IN
    SELECT o.id AS org_id
      FROM public.organizations o
     WHERE _org IS NULL OR o.id = _org
  LOOP
    SELECT count(*)::int
      INTO v_count
      FROM public.v_prospects_private_leaks v
     WHERE v.organization_id = r.org_id;

    IF v_count IS NULL OR v_count = 0 THEN CONTINUE; END IF;

    SELECT coalesce(array_agg(prospect_id), '{}'::uuid[])
      INTO v_samples
      FROM (
        SELECT prospect_id
          FROM public.v_prospects_private_leaks v
         WHERE v.organization_id = r.org_id
         ORDER BY v.updated_at DESC
         LIMIT 20
      ) s;

    INSERT INTO public.prospects_private_leak_alerts (organization_id, leak_count, sample_ids)
    VALUES (r.org_id, v_count, v_samples)
    RETURNING id INTO v_alert;

    out_org := r.org_id;
    out_leak_count := v_count;
    out_alert_id := v_alert;
    RETURN NEXT;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.check_prospects_private_leaks(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_prospects_private_leaks(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fix_prospects_private_leaks(_alert_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org   uuid;
  v_fixed integer;
BEGIN
  SELECT organization_id INTO v_org
    FROM public.prospects_private_leak_alerts WHERE id = _alert_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'alert_not_found'; END IF;
  IF NOT public.is_org_admin(v_org) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  WITH targets AS (
    SELECT prospect_id
      FROM public.v_prospects_private_leaks
     WHERE organization_id = v_org
  )
  UPDATE public.prospects p
     SET updated_at = now()
    FROM targets t
   WHERE p.id = t.prospect_id;
  GET DIAGNOSTICS v_fixed = ROW_COUNT;

  UPDATE public.prospects_private_leak_alerts
     SET status = 'corrigido', resolved_at = now(), resolved_by = auth.uid()
   WHERE id = _alert_id;

  RETURN v_fixed;
END $$;

REVOKE ALL ON FUNCTION public.fix_prospects_private_leaks(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fix_prospects_private_leaks(uuid) TO authenticated, service_role;
