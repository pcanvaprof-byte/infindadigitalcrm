-- =====================================================================
-- Onda 3 — Endurecimento final: UPDATE de public.prospects
-- Somente owner/admin da organização podem editar o cadastro compartilhado.
-- Members continuam podendo SELECT/INSERT e operar via user_lead_state.
-- =====================================================================

BEGIN;

-- Garantia dos helpers (idempotente).
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id FROM public.user_active_org WHERE user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;

-- Remove QUALQUER policy de UPDATE atual em prospects (defensivo).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prospects'
      AND cmd IN ('UPDATE','ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.prospects', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- Reafirma SELECT/INSERT (caso a varredura acima tenha derrubado uma policy ALL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospects'
      AND policyname='prospects_select_org_members'
  ) THEN
    CREATE POLICY "prospects_select_org_members"
      ON public.prospects
      FOR SELECT TO authenticated
      USING (organization_id = public.current_org_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='prospects'
      AND policyname='prospects_insert_org_members'
  ) THEN
    CREATE POLICY "prospects_insert_org_members"
      ON public.prospects
      FOR INSERT TO authenticated
      WITH CHECK (organization_id = public.current_org_id());
  END IF;
END $$;

-- UPDATE: exclusivo para owner/admin da organização do registro.
CREATE POLICY "prospects_update_owner_admin_only"
  ON public.prospects
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = public.prospects.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = public.prospects.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

-- Mantém DELETE restrito a owner/admin (recriado por segurança).
DROP POLICY IF EXISTS "prospects_delete_owner_admin_only" ON public.prospects;
CREATE POLICY "prospects_delete_owner_admin_only"
  ON public.prospects
  FOR DELETE
  TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = public.prospects.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;

COMMIT;

-- Verificação:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='prospects' ORDER BY cmd, policyname;