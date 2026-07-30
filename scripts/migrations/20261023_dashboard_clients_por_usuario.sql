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

-- View com o mesmo shape de public.clients, porém já filtrada pelo papel.
-- Owner/Admin enxergam tudo; Member enxerga apenas os próprios clientes.
-- (drop-in: pode substituir "public.clients" em qualquer FROM/JOIN, com ou sem alias)
DO $v$
DECLARE
  col text;
BEGIN
  SELECT c.column_name INTO col
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name  = 'clients'
     AND c.column_name IN ('user_id','owner_id','assigned_to')
   ORDER BY array_position(ARRAY['user_id','owner_id','assigned_to'], c.column_name)
   LIMIT 1;

  IF col IS NULL THEN
    RAISE EXCEPTION 'public.clients nao possui coluna de dono (user_id/owner_id/assigned_to).';
  END IF;

  EXECUTE format(
    'CREATE OR REPLACE VIEW public.v_clients_scoped WITH (security_invoker = on) AS
       SELECT * FROM public.clients
        WHERE public._is_org_admin() OR %I = auth.uid()', col);
END
$v$;

GRANT SELECT ON public.v_clients_scoped TO authenticated, service_role;

DO $mig$
DECLARE
  src     text;
  new_src text;
BEGIN
  src := pg_get_functiondef('public.dashboard_metrics()'::regprocedure);

  -- Já aplicado? sai sem fazer nada.
  IF src LIKE '%v_clients_scoped%' THEN
    RAISE NOTICE 'dashboard_metrics já está com escopo por usuário nos clientes.';
    RETURN;
  END IF;

  -- Troca toda referência à tabela pela view filtrada (\M evita pegar
  -- nomes como public.clients_algo).
  new_src := regexp_replace(src, 'public\.clients\M', 'public.v_clients_scoped', 'gi');

  IF new_src = src THEN
    RAISE EXCEPTION 'dashboard_metrics() nao referencia public.clients. Revise manualmente.';
  END IF;

  EXECUTE new_src;
END
$mig$;

GRANT EXECUTE ON FUNCTION public.dashboard_metrics() TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;