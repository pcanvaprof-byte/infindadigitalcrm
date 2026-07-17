-- =====================================================================
-- Onda 3 — Item 8: Endurecer RLS de public.prospects
-- Arquitetura híbrida:
--   * Lead compartilhado (cadastro em `prospects`)
--   * Operação privada (em `user_lead_state`)
--
-- Objetivo:
--   SELECT → todos os membros da organização ativa
--   INSERT → qualquer membro da organização ativa
--   UPDATE → somente Owner/Admin da organização ativa
--   DELETE → somente Owner/Admin da organização ativa
--
-- Observação: o trigger `prospects_freeze_shared_ops` já congela
-- colunas operacionais legadas — este bloco endurece o portão principal.
-- =====================================================================

BEGIN;

-- Remove policies antigas (nomes conhecidos + varredura defensiva).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'prospects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.prospects', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- Default de organization_id no INSERT (redundante com trigger _apply_tenant_isolation).
ALTER TABLE public.prospects
  ALTER COLUMN organization_id SET DEFAULT public.current_org_id();

-- SELECT: qualquer usuário autenticado da organização ativa.
CREATE POLICY "prospects_select_org_members"
  ON public.prospects
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_org_id());

-- INSERT: qualquer membro; org_id é forçado pela cláusula CHECK.
CREATE POLICY "prospects_insert_org_members"
  ON public.prospects
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

-- UPDATE: somente Owner/Admin da organização.
CREATE POLICY "prospects_update_owner_admin_only"
  ON public.prospects
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.current_org_role() IN ('owner','admin')
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public.current_org_role() IN ('owner','admin')
  );

-- DELETE: somente Owner/Admin da organização.
CREATE POLICY "prospects_delete_owner_admin_only"
  ON public.prospects
  FOR DELETE
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.current_org_role() IN ('owner','admin')
  );

-- Garante grants (Data API).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;

COMMIT;

-- Sanity: veja as policies resultantes
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='prospects';
