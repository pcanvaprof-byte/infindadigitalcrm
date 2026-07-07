
-- catalog_categorias
DROP POLICY IF EXISTS "catalog_categorias read" ON public.catalog_categorias;
CREATE POLICY "catalog_categorias read" ON public.catalog_categorias
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "catalog_categorias write" ON public.catalog_categorias;
CREATE POLICY "catalog_categorias write" ON public.catalog_categorias
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- catalog_items
DROP POLICY IF EXISTS "catalog_items read" ON public.catalog_items;
CREATE POLICY "catalog_items read" ON public.catalog_items
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "catalog_items write" ON public.catalog_items;
CREATE POLICY "catalog_items write" ON public.catalog_items
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- catalog_relacionamentos
DROP POLICY IF EXISTS "catalog_rel read" ON public.catalog_relacionamentos;
CREATE POLICY "catalog_rel read" ON public.catalog_relacionamentos
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "catalog_rel write" ON public.catalog_relacionamentos;
CREATE POLICY "catalog_rel write" ON public.catalog_relacionamentos
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
