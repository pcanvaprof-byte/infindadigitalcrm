-- HOTFIX: substitui gen_random_bytes (pgcrypto) por uuid-based token
create or replace function public.gen_proposal_token()
returns text
language sql
volatile
set search_path = public
as $$
  select translate(
    encode(
      decode(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 'hex'),
      'base64'
    ),
    '+/=', '-_'
  );
$$;
