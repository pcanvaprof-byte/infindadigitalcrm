-- ============================================================================
-- Correção: Cadência/Prospecção privadas para Member.
-- Owner/Admin continuam com visão organizacional.
-- Member vê apenas seus próprios cards, mensagens, notificações e touchpoints.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public._is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_org_role() IN ('owner', 'admin')
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

DROP POLICY IF EXISTS cad_leads_select ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_insert ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_update ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_delete ON public.cad_leads;

CREATE POLICY cad_leads_select ON public.cad_leads
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND (public._is_org_admin() OR owner_id = auth.uid()));

CREATE POLICY cad_leads_insert ON public.cad_leads
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND owner_id = auth.uid());

CREATE POLICY cad_leads_update ON public.cad_leads
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND (public._is_org_admin() OR owner_id = auth.uid()))
  WITH CHECK (organization_id = public.current_org_id() AND (public._is_org_admin() OR owner_id = auth.uid()));

CREATE POLICY cad_leads_delete ON public.cad_leads
  FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND (public._is_org_admin() OR owner_id = auth.uid()));

DROP POLICY IF EXISTS cad_messages_select ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_insert ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_update ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_delete ON public.cad_messages;

CREATE POLICY cad_messages_select ON public.cad_messages
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));

CREATE POLICY cad_messages_insert ON public.cad_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
    AND (author_id IS NULL OR author_id = auth.uid())
  );

CREATE POLICY cad_messages_update ON public.cad_messages
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id))
  WITH CHECK (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));

CREATE POLICY cad_messages_delete ON public.cad_messages
  FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));

DROP POLICY IF EXISTS cad_notif_select ON public.cad_notifications;
DROP POLICY IF EXISTS cad_notif_write ON public.cad_notifications;

CREATE POLICY cad_notif_select ON public.cad_notifications
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));

CREATE POLICY cad_notif_write ON public.cad_notifications
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id))
  WITH CHECK (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));

DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.prospect_touchpoints;
DROP POLICY IF EXISTS touchpoints_scope_by_role ON public.prospect_touchpoints;
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.prospect_interactions;
DROP POLICY IF EXISTS interactions_scope_by_role ON public.prospect_interactions;

CREATE POLICY touchpoints_scope_by_role ON public.prospect_touchpoints
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND (public._is_org_admin() OR user_id = auth.uid()))
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY interactions_scope_by_role ON public.prospect_interactions
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND (public._is_org_admin() OR user_id = auth.uid()))
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cad_register_send(
  p_lead uuid,
  p_tipo public.cad_msg_tipo,
  p_mensagem text,
  p_advance boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead public.cad_leads%rowtype;
  v_msg_id uuid;
  v_next_stage public.cad_stage;
  v_next_at timestamptz;
BEGIN
  SELECT * INTO v_lead FROM public.cad_leads WHERE id = p_lead;
  IF NOT FOUND THEN RAISE EXCEPTION 'lead não encontrado'; END IF;

  IF v_lead.organization_id <> public.current_org_id()
     OR (NOT public._is_org_admin() AND v_lead.owner_id <> auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado ao lead de cadência';
  END IF;

  INSERT INTO public.cad_messages (lead_id, organization_id, author_id, tipo, direction, stage_at_send, mensagem, status)
  VALUES (p_lead, v_lead.organization_id, auth.uid(), p_tipo, 'out', v_lead.stage, p_mensagem, 'enviada')
  RETURNING id INTO v_msg_id;

  IF p_advance AND v_lead.stage::text LIKE 'followup_%' THEN
    v_next_stage := public.cad_next_stage(v_lead.stage);
    v_next_at := public.cad_next_action_for_stage(v_next_stage, now());
    UPDATE public.cad_leads SET last_contact_at = now(), stage = v_next_stage, next_action_at = v_next_at WHERE id = p_lead;
  ELSE
    UPDATE public.cad_leads SET last_contact_at = now() WHERE id = p_lead;
  END IF;

  RETURN v_msg_id;
END $$;

GRANT EXECUTE ON FUNCTION public.cad_register_send(uuid, public.cad_msg_tipo, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.cad_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_uid uuid := auth.uid();
  v_admin boolean := public._is_org_admin();
  v_total int; v_by_stage jsonb; v_total_msgs int; v_total_resp int;
  v_total_fech int; v_taxa_resp numeric; v_taxa_conv numeric; v_serie jsonb;
BEGIN
  SELECT count(*) INTO v_total FROM public.cad_leads l
   WHERE l.organization_id = v_org AND (v_admin OR l.owner_id = v_uid);

  SELECT coalesce(jsonb_object_agg(stage, c), '{}'::jsonb) INTO v_by_stage
  FROM (
    SELECT l.stage::text AS stage, count(*) c FROM public.cad_leads l
    WHERE l.organization_id = v_org AND (v_admin OR l.owner_id = v_uid)
    GROUP BY l.stage
  ) s;

  SELECT count(*) INTO v_total_msgs FROM public.cad_messages m
  JOIN public.cad_leads l ON l.id = m.lead_id
  WHERE m.organization_id = v_org AND m.direction = 'out'
    AND (v_admin OR l.owner_id = v_uid OR m.author_id = v_uid);

  SELECT count(DISTINCT m.lead_id) INTO v_total_resp FROM public.cad_messages m
  JOIN public.cad_leads l ON l.id = m.lead_id
  WHERE m.organization_id = v_org AND m.direction = 'in'
    AND (v_admin OR l.owner_id = v_uid OR m.author_id = v_uid);

  SELECT count(*) INTO v_total_fech FROM public.cad_leads l
  WHERE l.organization_id = v_org AND l.stage = 'fechado'
    AND (v_admin OR l.owner_id = v_uid);

  v_taxa_resp := CASE WHEN v_total > 0 THEN round(v_total_resp::numeric * 100 / v_total, 1) ELSE 0 END;
  v_taxa_conv := CASE WHEN v_total > 0 THEN round(v_total_fech::numeric * 100 / v_total, 1) ELSE 0 END;

  SELECT coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'enviadas', enviadas, 'respostas', respostas) ORDER BY dia), '[]'::jsonb)
  INTO v_serie
  FROM (
    SELECT d::date AS dia,
      (SELECT count(*) FROM public.cad_messages m JOIN public.cad_leads l ON l.id = m.lead_id
       WHERE m.organization_id = v_org AND m.direction = 'out'
         AND (v_admin OR l.owner_id = v_uid OR m.author_id = v_uid)
         AND m.created_at::date = d::date) AS enviadas,
      (SELECT count(*) FROM public.cad_messages m JOIN public.cad_leads l ON l.id = m.lead_id
       WHERE m.organization_id = v_org AND m.direction = 'in'
         AND (v_admin OR l.owner_id = v_uid OR m.author_id = v_uid)
         AND m.created_at::date = d::date) AS respostas
    FROM generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') d
  ) s;

  RETURN jsonb_build_object(
    'total', v_total,
    'by_stage', v_by_stage,
    'taxa_resposta', v_taxa_resp,
    'taxa_conversao', v_taxa_conv,
    'total_mensagens', v_total_msgs,
    'serie_30d', v_serie
  );
END $$;

GRANT EXECUTE ON FUNCTION public.cad_dashboard_metrics() TO authenticated;

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
      AND (public._is_org_admin() OR l.owner_id = auth.uid() OR m.author_id = auth.uid())
    GROUP BY 1
  )
  SELECT d.dia, coalesce(a.enviadas, 0) AS enviadas, coalesce(a.respostas, 0) AS respostas
  FROM dias d LEFT JOIN agg a USING (dia)
  ORDER BY d.dia ASC;
$$;

GRANT EXECUTE ON FUNCTION public.cad_metrics_serie_30d() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;