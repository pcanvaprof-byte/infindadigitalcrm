
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cad_messages','contrato_eventos','contratos','prospects'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.%I', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation_restrictive ON public.%I
      AS RESTRICTIVE FOR ALL TO authenticated, anon
      USING (organization_id = public.current_org_id())
      WITH CHECK (organization_id = public.current_org_id())
    $p$, t);
  END LOOP;
END $$;
