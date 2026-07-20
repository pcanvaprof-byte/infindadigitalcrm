
-- 1) cad_pack_favorites: add organization scope to policy
DROP POLICY IF EXISTS cad_pack_favorites_own ON public.cad_pack_favorites;
CREATE POLICY cad_pack_favorites_own ON public.cad_pack_favorites
FOR ALL TO authenticated
USING (user_id = auth.uid() AND organization_id = public.current_org_id())
WITH CHECK (user_id = auth.uid() AND organization_id = public.current_org_id());

-- 2) plan_templates: add organization_id and scope read policy
ALTER TABLE public.plan_templates ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS plan_templates_org_idx ON public.plan_templates(organization_id);

DROP POLICY IF EXISTS plan_templates_read ON public.plan_templates;
CREATE POLICY plan_templates_read ON public.plan_templates
FOR SELECT TO authenticated
USING (organization_id IS NULL OR organization_id = public.current_org_id());
