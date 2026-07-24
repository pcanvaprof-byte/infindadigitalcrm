-- =========================================================
-- CAD_LEADS: leitura compartilhada por organização
-- =========================================================
DROP POLICY IF EXISTS cad_leads_select ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_select_own ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_select_org ON public.cad_leads;

CREATE POLICY cad_leads_select_org ON public.cad_leads
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

-- INSERT/UPDATE/DELETE: manter restrito ao dono ou admin da org
DROP POLICY IF EXISTS cad_leads_insert ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_insert_own ON public.cad_leads;
CREATE POLICY cad_leads_insert_own ON public.cad_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public._is_org_admin())
  );

DROP POLICY IF EXISTS cad_leads_update ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_update_own ON public.cad_leads;
CREATE POLICY cad_leads_update_own ON public.cad_leads
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public._is_org_admin())
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public._is_org_admin())
  );

DROP POLICY IF EXISTS cad_leads_delete ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_delete_own ON public.cad_leads;
CREATE POLICY cad_leads_delete_own ON public.cad_leads
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public._is_org_admin())
  );

-- =========================================================
-- CAD_MESSAGES: leitura compartilhada por organização
-- =========================================================
DROP POLICY IF EXISTS cad_messages_select ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_select_own ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_select_org ON public.cad_messages;

CREATE POLICY cad_messages_select_org ON public.cad_messages
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

-- INSERT/UPDATE/DELETE: apenas dono do lead ou admin
DROP POLICY IF EXISTS cad_messages_insert ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_insert_own ON public.cad_messages;
CREATE POLICY cad_messages_insert_own ON public.cad_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public._is_org_admin()
      OR EXISTS (
        SELECT 1 FROM public.cad_leads l
        WHERE l.id = cad_messages.lead_id
          AND l.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS cad_messages_update ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_update_own ON public.cad_messages;
CREATE POLICY cad_messages_update_own ON public.cad_messages
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public._is_org_admin()
      OR EXISTS (
        SELECT 1 FROM public.cad_leads l
        WHERE l.id = cad_messages.lead_id
          AND l.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS cad_messages_delete ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_delete_own ON public.cad_messages;
CREATE POLICY cad_messages_delete_own ON public.cad_messages
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public._is_org_admin()
      OR EXISTS (
        SELECT 1 FROM public.cad_leads l
        WHERE l.id = cad_messages.lead_id
          AND l.owner_id = auth.uid()
      )
    )
  );

-- =========================================================
-- Ajustar métricas do dashboard de cadência para refletir a organização inteira
-- (visibilidade compartilhada de aquecimento)
-- =========================================================
CREATE OR REPLACE FUNCTION public.cad_metrics_serie_30d()
 RETURNS TABLE(dia date, enviadas bigint, respostas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH dias AS (
    SELECT (current_date - i)::date AS dia
    FROM generate_series(0, 29) AS i
  ),
  agg AS (
    SELECT
      date_trunc('day', m.created_at)::date AS dia,
      count(*) FILTER (WHERE m.direction <> 'in') AS enviadas,
      count(*) FILTER (WHERE m.direction = 'in') AS respostas
    FROM public.cad_messages m
    WHERE m.created_at >= (current_date - interval '29 days')
      AND m.organization_id = public.current_org_id()
    GROUP BY 1
  )
  SELECT d.dia,
         coalesce(a.enviadas, 0) AS enviadas,
         coalesce(a.respostas, 0) AS respostas
  FROM dias d
  LEFT JOIN agg a USING (dia)
  ORDER BY d.dia ASC;
$function$;