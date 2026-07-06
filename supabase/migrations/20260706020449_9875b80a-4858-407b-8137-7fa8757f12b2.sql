CREATE OR REPLACE FUNCTION public.gen_briefing_token()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public, extensions
AS $$
  SELECT translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_')
$$;

REVOKE ALL ON FUNCTION public.gen_briefing_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_briefing_token() TO service_role;

ALTER TABLE public.briefings
  ALTER COLUMN token_publico SET DEFAULT public.gen_briefing_token();

UPDATE public.briefings
   SET token_publico = public.gen_briefing_token()
 WHERE status IS DISTINCT FROM 'concluido'
   AND status IS DISTINCT FROM 'cancelado';