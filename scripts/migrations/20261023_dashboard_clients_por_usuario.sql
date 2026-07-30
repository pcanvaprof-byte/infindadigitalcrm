-- ============================================================================
-- Dashboard: bloco de CLIENTES passa a respeitar o papel do usuário.
--   Owner/Admin  -> visão da organização (inalterado)
--   Member       -> apenas os clientes atribuídos a ele (clients.user_id)
--
-- Aplicado por reescrita cirúrgica da função viva (dashboard_metrics),
-- para não perder ajustes anteriores de prospects/touchpoints.
-- ============================================================================

BEGIN;
SET LOCAL check_function_bodies = off;

-- Helper de papel (idempotente).
CREATE OR REPLACE FUNCTION public._is_org_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_org_role() IN ('owner','admin'), false)
$$;
REVOKE ALL ON FUNCTION public._is_org_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._is_org_admin() TO authenticated, service_role;

DO $mig$
DECLARE
  src     text;
  new_src text;
BEGIN
  src := pg_get_functiondef('public.dashboard_metrics()'::regprocedure);

  -- Já aplicado? sai sem fazer nada.
  IF src LIKE '%-- member_scope_clients%' THEN
    RAISE NOTICE 'dashboard_metrics já está com escopo por usuário nos clientes.';
    RETURN;
  END IF;

  new_src := regexp_replace(
    src,
    'from\s+public\.clients\s+where\s+organization_id\s*=\s*v_org',
    'from public.clients where organization_id = v_org'
    || ' and (public._is_org_admin() or user_id = auth.uid()) -- member_scope_clients',
    'gi'
  );

  IF new_src = src THEN
    RAISE EXCEPTION 'Nao encontrei o bloco "from public.clients where organization_id = v_org" em dashboard_metrics(). Aborte e revise manualmente.';
  END IF;

  EXECUTE new_src;
END
$mig$;

GRANT EXECUTE ON FUNCTION public.dashboard_metrics() TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;