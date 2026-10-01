
-- adjustment_notes
DROP POLICY IF EXISTS adjustment_notes_scope ON public.adjustment_notes;
CREATE POLICY adjustment_notes_scope ON public.adjustment_notes
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((organization_id = current_org_id()) AND _can_see_client(client_id))
  WITH CHECK ((organization_id = current_org_id()) AND _can_see_client(client_id));

-- cad_messages
DROP POLICY IF EXISTS cad_messages_select ON public.cad_messages;
CREATE POLICY cad_messages_select ON public.cad_messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organization_id = current_org_id()) AND _can_see_cad_lead(lead_id));

DROP POLICY IF EXISTS cad_messages_update ON public.cad_messages;
CREATE POLICY cad_messages_update ON public.cad_messages
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((organization_id = current_org_id()) AND _can_see_cad_lead(lead_id));

DROP POLICY IF EXISTS cad_messages_delete ON public.cad_messages;
CREATE POLICY cad_messages_delete ON public.cad_messages
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((organization_id = current_org_id()) AND _can_see_cad_lead(lead_id));

-- cad_notifications
DROP POLICY IF EXISTS cad_notif_select ON public.cad_notifications;
CREATE POLICY cad_notif_select ON public.cad_notifications
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((organization_id = current_org_id()) AND _can_see_cad_lead(lead_id));

-- client_billing_items
DROP POLICY IF EXISTS client_billing_items_scope ON public.client_billing_items;
CREATE POLICY client_billing_items_scope ON public.client_billing_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((organization_id = current_org_id()) AND _can_see_client(client_id))
  WITH CHECK ((organization_id = current_org_id()) AND _can_see_client(client_id));

-- client_events
DROP POLICY IF EXISTS client_events_scope ON public.client_events;
CREATE POLICY client_events_scope ON public.client_events
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((organization_id = current_org_id()) AND _can_see_client(client_id))
  WITH CHECK ((organization_id = current_org_id()) AND _can_see_client(client_id));
