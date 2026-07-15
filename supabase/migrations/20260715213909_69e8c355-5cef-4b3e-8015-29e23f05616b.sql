-- Onda 1: revogar EXECUTE de anon em funções internas SECURITY DEFINER
-- que dependem de auth.uid() / current_org_id() e não têm razão de ser
-- chamadas sem autenticação. Endpoints públicos por token (get_proposal_by_token,
-- get_briefing_by_token, update_briefing_by_token, submit_proposal_decision,
-- register_proposal_view) permanecem acessíveis a anon.

REVOKE EXECUTE ON FUNCTION public._can_see_cad_lead(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._can_see_client(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_org_role() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cad_niche_pack_edited_keys() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cad_niche_pack_reset(text, public.cad_stage) FROM anon, public;

-- cad_niche_pack_stages / cad_niche_pack_upsert podem ter várias assinaturas.
-- Fazemos revoke dinâmico para todas as sobrecargas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('cad_niche_pack_stages','cad_niche_pack_upsert')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', r.sig);
  END LOOP;
END $$;

-- Garantir que authenticated / service_role continuam com EXECUTE explícito
GRANT EXECUTE ON FUNCTION public._can_see_cad_lead(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._can_see_client(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_org_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cad_niche_pack_edited_keys() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cad_niche_pack_reset(text, public.cad_stage) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('cad_niche_pack_stages','cad_niche_pack_upsert')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;
