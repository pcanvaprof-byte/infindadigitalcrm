DROP POLICY IF EXISTS plan_templates_admin_write ON public.plan_templates;
CREATE POLICY plan_templates_admin_write ON public.plan_templates
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND organization_id = public.current_org_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    AND organization_id = public.current_org_id()
  );