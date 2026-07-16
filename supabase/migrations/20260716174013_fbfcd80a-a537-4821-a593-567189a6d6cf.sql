
DROP POLICY IF EXISTS cad_messages_insert ON public.cad_messages;
CREATE POLICY cad_messages_insert ON public.cad_messages
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));

DROP POLICY IF EXISTS cad_notif_write ON public.cad_notifications;
CREATE POLICY cad_notif_write ON public.cad_notifications
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id))
  WITH CHECK (organization_id = public.current_org_id() AND public._can_see_cad_lead(lead_id));
