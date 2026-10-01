-- ============================================================================
-- Reverte o compartilhamento organizacional do aquecimento.
-- Cadência volta a ser PRIVADA por usuário:
--   member  -> vê apenas os próprios cards/mensagens
--   owner/admin -> visão organizacional
-- ============================================================================

BEGIN;

-- helpers (recriados aqui para a migração ser autossuficiente)
CREATE OR REPLACE FUNCTION public._is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.current_org_role() IN ('owner', 'admin'), false)
$$;

REVOKE ALL ON FUNCTION public._is_org_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._is_org_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._can_see_cad_lead(_lead uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cad_leads l
    WHERE l.id = _lead
      AND l.organization_id = public.current_org_id()
      AND (public._is_org_admin() OR l.owner_id = auth.uid())
  )
$$;

REVOKE ALL ON FUNCTION public._can_see_cad_lead(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._can_see_cad_lead(uuid) TO authenticated, service_role;

-- alias usado pelas policies abaixo
CREATE OR REPLACE FUNCTION public.cad_is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.current_org_role() IN ('owner', 'admin'), false);
$$;

GRANT EXECUTE ON FUNCTION public.cad_is_org_admin() TO authenticated;

DROP POLICY IF EXISTS cad_leads_select ON public.cad_leads;
CREATE POLICY cad_leads_select ON public.cad_leads
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (public.cad_is_org_admin() OR owner_id = auth.uid())
  );

DROP POLICY IF EXISTS cad_messages_select ON public.cad_messages;
CREATE POLICY cad_messages_select ON public.cad_messages
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.cad_is_org_admin()
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.cad_leads l
        WHERE l.id = cad_messages.lead_id
          AND l.owner_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.cad_metrics_serie_30d()
RETURNS table(dia date, enviadas bigint, respostas bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH dias AS (
    SELECT (current_date - i)::date AS dia FROM generate_series(0, 29) AS i
  ),
  agg AS (
    SELECT date_trunc('day', m.created_at)::date AS dia,
      count(*) FILTER (WHERE m.direction <> 'in') AS enviadas,
      count(*) FILTER (WHERE m.direction = 'in') AS respostas
    FROM public.cad_messages m
    JOIN public.cad_leads l ON l.id = m.lead_id
    WHERE m.created_at >= (current_date - interval '29 days')
      AND m.organization_id = public.current_org_id()
      AND (public.cad_is_org_admin() OR l.owner_id = auth.uid() OR m.author_id = auth.uid())
    GROUP BY 1
  )
  SELECT d.dia, coalesce(a.enviadas, 0), coalesce(a.respostas, 0)
  FROM dias d LEFT JOIN agg a USING (dia)
  ORDER BY d.dia ASC;
$$;

GRANT EXECUTE ON FUNCTION public.cad_metrics_serie_30d() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
