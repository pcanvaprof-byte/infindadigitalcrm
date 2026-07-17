-- Isolamento por usuário nas tabelas operacionais da Cadência.
-- Members: só veem/alteram seus próprios registros (owner_id = auth.uid()).
-- Owner/Admin: continuam com visão total da organização.
-- Arquitetura oficial: leads compartilhados (prospects), cadência privada.

-- =============================================================================
-- cad_leads
-- =============================================================================
DROP POLICY IF EXISTS cad_leads_select ON public.cad_leads;
CREATE POLICY cad_leads_select ON public.cad_leads
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cad_leads_insert ON public.cad_leads;
CREATE POLICY cad_leads_insert ON public.cad_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS cad_leads_update ON public.cad_leads;
CREATE POLICY cad_leads_update ON public.cad_leads
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cad_leads_delete ON public.cad_leads;
CREATE POLICY cad_leads_delete ON public.cad_leads
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  );

-- =============================================================================
-- cad_messages  — herda visibilidade do lead pai via _can_see_cad_lead()
-- =============================================================================
DROP POLICY IF EXISTS cad_messages_select ON public.cad_messages;
CREATE POLICY cad_messages_select ON public.cad_messages
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

DROP POLICY IF EXISTS cad_messages_insert ON public.cad_messages;
CREATE POLICY cad_messages_insert ON public.cad_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

DROP POLICY IF EXISTS cad_messages_update ON public.cad_messages;
CREATE POLICY cad_messages_update ON public.cad_messages
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

DROP POLICY IF EXISTS cad_messages_delete ON public.cad_messages;
CREATE POLICY cad_messages_delete ON public.cad_messages
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

-- =============================================================================
-- cad_notifications  — mesma regra: só vê notificação do lead que já enxerga.
-- =============================================================================
DROP POLICY IF EXISTS cad_notif_select ON public.cad_notifications;
CREATE POLICY cad_notif_select ON public.cad_notifications
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

DROP POLICY IF EXISTS cad_notif_write ON public.cad_notifications;
CREATE POLICY cad_notif_write ON public.cad_notifications
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

-- Garante que a função helper esteja executável pelo role.
GRANT EXECUTE ON FUNCTION public._can_see_cad_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_role() TO authenticated;
