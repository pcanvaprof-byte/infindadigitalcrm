-- Execute no Supabase externo (oxmhwwopxurwqcrwgsyf) via SQL Editor.
-- Amplia a check constraint de user_access.access_type para aceitar 'demo',
-- permitindo que claimDemoAccess/startDemo gravem o tipo correto ao invés
-- de falhar silenciosamente (o usuário ficava sem user_access e caía em
-- "access_expired").

alter table public.user_access
  drop constraint if exists user_access_access_type_check;

alter table public.user_access
  add constraint user_access_access_type_check
  check (access_type = any (array['trial','paid','internal','demo']));

-- Sanity check (opcional): lista os tipos existentes hoje.
-- select access_type, count(*) from public.user_access group by 1 order by 1;