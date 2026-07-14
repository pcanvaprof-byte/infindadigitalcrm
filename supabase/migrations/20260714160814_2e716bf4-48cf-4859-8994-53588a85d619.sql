
-- Helper: check if the caller can see a cad_lead
CREATE OR REPLACE FUNCTION public._can_see_cad_lead(_lead uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cad_leads l
    WHERE l.id = _lead
      AND l.organization_id = public.current_org_id()
      AND (public.current_org_role() IN ('owner','admin') OR l.owner_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public._can_see_client(_client uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = _client
      AND c.organization_id = public.current_org_id()
      AND (public.current_org_role() IN ('owner','admin') OR c.user_id = auth.uid())
  )
$$;

-- cad_messages: Member só vê mensagens de leads próprios
DROP POLICY IF EXISTS cad_messages_select ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_update ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_delete ON public.cad_messages;
CREATE POLICY cad_messages_select ON public.cad_messages FOR SELECT
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));
CREATE POLICY cad_messages_update ON public.cad_messages FOR UPDATE
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));
CREATE POLICY cad_messages_delete ON public.cad_messages FOR DELETE
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));

-- cad_notifications
DROP POLICY IF EXISTS cad_notif_select ON public.cad_notifications;
DROP POLICY IF EXISTS cad_notif_write ON public.cad_notifications;
CREATE POLICY cad_notif_select ON public.cad_notifications FOR SELECT
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));
CREATE POLICY cad_notif_write ON public.cad_notifications FOR ALL
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id))
  WITH CHECK (organization_id = public.current_org_id());

-- adjustment_notes
DROP POLICY IF EXISTS "org members manage adjustment notes" ON public.adjustment_notes;
CREATE POLICY adjustment_notes_scope ON public.adjustment_notes FOR ALL
  USING (organization_id = public.current_org_id() AND public._can_see_client(client_id))
  WITH CHECK (organization_id = public.current_org_id() AND public._can_see_client(client_id));

-- client_events
DROP POLICY IF EXISTS client_events_org_rw ON public.client_events;
CREATE POLICY client_events_scope ON public.client_events FOR ALL
  USING (organization_id = public.current_org_id() AND public._can_see_client(client_id))
  WITH CHECK (organization_id = public.current_org_id() AND public._can_see_client(client_id));

-- client_billing_items
DROP POLICY IF EXISTS cbi_org_members_rw ON public.client_billing_items;
CREATE POLICY client_billing_items_scope ON public.client_billing_items FOR ALL
  USING (organization_id = public.current_org_id() AND public._can_see_client(client_id))
  WITH CHECK (organization_id = public.current_org_id() AND public._can_see_client(client_id));
