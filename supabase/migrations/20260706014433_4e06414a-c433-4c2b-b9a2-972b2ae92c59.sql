
-- 1) cad_leads: restrict UPDATE to owner or org admin
DROP POLICY IF EXISTS cad_leads_update ON public.cad_leads;
CREATE POLICY cad_leads_update ON public.cad_leads
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public.is_org_admin(organization_id))
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public.is_org_admin(organization_id))
  );

-- 2) user_active_org: add explicit self-scoped DELETE policy
DROP POLICY IF EXISTS active_org_self_delete ON public.user_active_org;
CREATE POLICY active_org_self_delete ON public.user_active_org
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT DELETE ON public.user_active_org TO authenticated;

-- 3) Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER
--    helpers and trigger functions that must not be callable via the API.
REVOKE EXECUTE ON FUNCTION public._bi_org() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._infinda_log_activity(uuid, uuid, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._infinda_log_deal_stage() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._infinda_on_briefing_created() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._infinda_on_prospect_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._infinda_touch_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.advance_prospect_cadence() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cad_handle_new_org() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_default_org() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dashboard_current_org_id() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cad_seed_templates(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_briefing_resumo_ia(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public._apply_tenant_isolation(text) FROM anon, authenticated, PUBLIC;

-- Also lock the token-based public briefing helpers to anon only where truly needed,
-- and remove authenticated redundancy for the write path (safer default: only anon
-- writes via public token flow; authenticated users update via normal RLS).
REVOKE EXECUTE ON FUNCTION public.update_briefing_by_token(text, jsonb, text) FROM authenticated;
