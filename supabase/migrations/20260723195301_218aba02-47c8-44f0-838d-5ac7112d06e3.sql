-- Enforce organization_id NOT NULL and remove NULL bypass in briefings RLS
ALTER TABLE public.briefings ALTER COLUMN organization_id SET NOT NULL;

DROP POLICY IF EXISTS briefings_scope_by_role ON public.briefings;
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.briefings;

CREATE POLICY briefings_scope_by_role ON public.briefings
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    organization_id = current_org_id()
    AND (
      current_org_role() = ANY (ARRAY['owner'::text, 'admin'::text])
      OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = current_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY tenant_isolation_restrictive ON public.briefings
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());