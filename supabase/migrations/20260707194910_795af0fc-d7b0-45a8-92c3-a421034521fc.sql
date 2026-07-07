-- Revoke EXECUTE from anon and PUBLIC on every function in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE to anon on the public-token entry points only
GRANT EXECUTE ON FUNCTION public.get_briefing_by_token(text)                        TO anon;
GRANT EXECUTE ON FUNCTION public.update_briefing_by_token(text, jsonb, text)        TO anon;
GRANT EXECUTE ON FUNCTION public.get_proposal_by_token(text)                        TO anon;
GRANT EXECUTE ON FUNCTION public.register_proposal_view(text, text, text)           TO anon;
GRANT EXECUTE ON FUNCTION public.submit_proposal_decision(text, text, text, text, text, text, text) TO anon;
