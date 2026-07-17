-- =====================================================================
-- Onda 3 — Item 8: Endurecer RLS de public.prospects
-- Arquitetura híbrida (lead compartilhado + operação privada)
-- =====================================================================

BEGIN;

-- 0) Garante helpers básicos neste banco.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id FROM public.user_active_org WHERE user_id = auth.uid()
$$;

-- Mantida por compatibilidade com outras partes do sistema.
CREATE OR REPLACE FUNCTION public.current_org_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.role
  FROM public.organization_members m
  JOIN public.user_active_org uao
    ON uao.user_id = m.user_id
   AND uao.organization_id = m.organization_id
  WHERE m.user_id = auth.uid()
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_org_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_org_role() TO authenticated, service_role;

-- 1) Remove policies antigas de prospects (varredura defensiva).
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

-- 2) Default do organization_id via função.
ALTER TABLE public.prospects
  ALTER COLUMN organization_id SET DEFAULT public.current_org_id();

-- 3) Policies alinhadas à arquitetura híbrida.
CREATE POLICY "prospects_select_org_members"
  ON public.prospects
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY "prospects_insert_org_members"
  ON public.prospects
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.current_org_id());

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

-- Sanity check:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename='prospects';
