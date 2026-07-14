-- Papéis owner/admin/member: escopo de dados por papel dentro da organização.
-- Owner e admin veem tudo da org; member vê apenas os próprios registros.

-- 1) Helper: papel do usuário na organização ativa.
CREATE OR REPLACE FUNCTION public.current_org_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
  FROM public.organization_members m
  JOIN public.user_active_org uao
    ON uao.user_id = m.user_id
   AND uao.organization_id = m.organization_id
  WHERE m.user_id = auth.uid()
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.current_org_role() TO authenticated;

-- 2) CLIENTS: remover policy legada baseada em has_role() do enum app_role.
--    Manter tenant_isolation_restrictive (RESTRICTIVE) e criar uma PERMISSIVE
--    que respeita papel na org.
DROP POLICY IF EXISTS "clients_owner_or_admin" ON public.clients;

CREATE POLICY "clients_scope_by_role"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR user_id = auth.uid()
    )
  );

-- 3) PROSPECTS: sem organization_id na tabela. Escopo por dono direto e,
--    para owner/admin, ampliação via membership na org ativa.
DROP POLICY IF EXISTS "Users manage own prospects" ON public.prospects;

CREATE POLICY "prospects_scope_by_role"
  ON public.prospects
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      public.current_org_role() IN ('owner','admin')
      AND EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.user_id = prospects.user_id
          AND m.organization_id = public.current_org_id()
      )
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      public.current_org_role() IN ('owner','admin')
      AND EXISTS (
        SELECT 1 FROM public.organization_members m
        WHERE m.user_id = prospects.user_id
          AND m.organization_id = public.current_org_id()
      )
    )
  );

-- 4) CAD_LEADS (cadência): escopo por owner_id para member.
DROP POLICY IF EXISTS cad_leads_select ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_update ON public.cad_leads;
DROP POLICY IF EXISTS cad_leads_delete ON public.cad_leads;

CREATE POLICY cad_leads_select
  ON public.cad_leads
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  );

CREATE POLICY cad_leads_update
  ON public.cad_leads
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  );

CREATE POLICY cad_leads_delete
  ON public.cad_leads
  FOR DELETE
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public.current_org_role() IN ('owner','admin')
      OR owner_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';