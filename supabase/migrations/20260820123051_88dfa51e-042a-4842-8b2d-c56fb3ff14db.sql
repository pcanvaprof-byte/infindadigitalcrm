ALTER FUNCTION public._prospect_norm_city(text) SET search_path = public;
ALTER FUNCTION public._prospect_norm_cnpj(text) SET search_path = public;
ALTER FUNCTION public._prospect_norm_name(text) SET search_path = public;

-- adjustment_notes: split ALL policy so writes require authorship
DROP POLICY IF EXISTS adjustment_notes_scope ON public.adjustment_notes;
CREATE POLICY adjustment_notes_select ON public.adjustment_notes FOR SELECT TO authenticated
  USING (organization_id = current_org_id() AND _can_see_client(client_id));
CREATE POLICY adjustment_notes_insert ON public.adjustment_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id() AND _can_see_client(client_id) AND user_id = auth.uid());
CREATE POLICY adjustment_notes_update ON public.adjustment_notes FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND _can_see_client(client_id) AND user_id = auth.uid())
  WITH CHECK (organization_id = current_org_id() AND _can_see_client(client_id) AND user_id = auth.uid());
CREATE POLICY adjustment_notes_delete ON public.adjustment_notes FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND _can_see_client(client_id) AND user_id = auth.uid());

-- client_events: same, user_id nullable (system events)
DROP POLICY IF EXISTS client_events_scope ON public.client_events;
CREATE POLICY client_events_select ON public.client_events FOR SELECT TO authenticated
  USING (organization_id = current_org_id() AND _can_see_client(client_id));
CREATE POLICY client_events_insert ON public.client_events FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id() AND _can_see_client(client_id) AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY client_events_update ON public.client_events FOR UPDATE TO authenticated
  USING (organization_id = current_org_id() AND _can_see_client(client_id) AND user_id = auth.uid())
  WITH CHECK (organization_id = current_org_id() AND _can_see_client(client_id) AND user_id = auth.uid());
CREATE POLICY client_events_delete ON public.client_events FOR DELETE TO authenticated
  USING (organization_id = current_org_id() AND _can_see_client(client_id) AND user_id = auth.uid());