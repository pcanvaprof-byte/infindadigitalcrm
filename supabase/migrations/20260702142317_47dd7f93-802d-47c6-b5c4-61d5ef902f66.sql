
-- 1) Fix mutable search_path on helper functions
ALTER FUNCTION public._apply_tenant_isolation(text) SET search_path = public;
ALTER FUNCTION public._infinda_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.cad_next_action_for_stage(cad_stage, timestamptz) SET search_path = public;
ALTER FUNCTION public.cad_next_stage(cad_stage) SET search_path = public;
ALTER FUNCTION public.cad_seed_templates(uuid) SET search_path = public;
ALTER FUNCTION public.cad_set_updated_at() SET search_path = public;
ALTER FUNCTION public.catalog_items_set_updated_at() SET search_path = public;

-- 2) Lock down SECURITY DEFINER function execution
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Public token-based briefing flow (called by anonymous prospects):
GRANT EXECUTE ON FUNCTION public.get_briefing_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_briefing_by_token(text, jsonb, text) TO anon;

-- 3) Catalog tables: restrict writes to authenticated users (previously USING true)
DROP POLICY IF EXISTS "catalog_categorias write" ON public.catalog_categorias;
CREATE POLICY "catalog_categorias write" ON public.catalog_categorias
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "catalog_items write" ON public.catalog_items;
CREATE POLICY "catalog_items write" ON public.catalog_items
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "catalog_rel write" ON public.catalog_relacionamentos;
CREATE POLICY "catalog_rel write" ON public.catalog_relacionamentos
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4) cad_leads: only owner or org admin/owner may delete
CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org
      AND user_id = auth.uid()
      AND role IN ('owner','admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS cad_leads_delete ON public.cad_leads;
CREATE POLICY cad_leads_delete ON public.cad_leads
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (owner_id = auth.uid() OR public.is_org_admin(organization_id))
  );

-- 5) organization_members: allow members to view teammates in their own orgs (safe, non-recursive)
CREATE OR REPLACE FUNCTION public.is_member_of_org(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_member_of_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member_of_org(uuid) TO authenticated;

DROP POLICY IF EXISTS members_view_own ON public.organization_members;
CREATE POLICY members_view_org ON public.organization_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_member_of_org(organization_id));

-- 6) briefings: explicit anon access is intentionally NOT granted at the RLS level.
--    Public/token-based access flows exclusively through the SECURITY DEFINER
--    RPCs get_briefing_by_token / update_briefing_by_token (granted to anon above),
--    which validate the token before returning data. No service_role bypass is used.
