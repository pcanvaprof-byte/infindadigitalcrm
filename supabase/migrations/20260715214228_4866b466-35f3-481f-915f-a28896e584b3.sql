-- contratos: usa user_id direto (coluna existe)
DROP POLICY IF EXISTS contratos_org_rw ON public.contratos;
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.contratos;

CREATE POLICY contratos_scope_by_role ON public.contratos
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (public.current_org_role() IN ('owner','admin') OR user_id = auth.uid())
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (public.current_org_role() IN ('owner','admin') OR user_id = auth.uid())
  );

-- contrato_eventos: escopa pelo contrato pai
DROP POLICY IF EXISTS contrato_eventos_org_rw ON public.contrato_eventos;

CREATE POLICY contrato_eventos_scope_by_role ON public.contrato_eventos
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR EXISTS (
        SELECT 1 FROM public.contratos c
         WHERE c.id = contrato_eventos.contrato_id
           AND c.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR EXISTS (
        SELECT 1 FROM public.contratos c
         WHERE c.id = contrato_eventos.contrato_id
           AND c.user_id = auth.uid()
      )
    )
  );
