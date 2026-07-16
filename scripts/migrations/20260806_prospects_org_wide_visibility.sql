-- ============================================================================
-- Prospects: visibilidade e edição para TODOS os membros da organização.
-- Aplicar no Supabase externo (oxmhwwopxurwqcrwgsyf) via SQL Editor.
--
-- Regra pedida: qualquer membro da org enxerga e edita todos os prospects
-- cadastrados por qualquer outro membro (não fica mais restrito ao dono).
-- ============================================================================

-- 1) Garante coluna organization_id + RLS restritiva por org.
select public._apply_tenant_isolation('prospects');

-- 2) Backfill: alinha organization_id com a org ativa do dono, quando faltar.
update public.prospects p
   set organization_id = uao.organization_id
  from public.user_active_org uao
 where uao.user_id = p.user_id
   and (p.organization_id is null
        or p.organization_id <> uao.organization_id);

-- 3) Remove policies antigas baseadas em user_id.
do $$
declare r record;
begin
  for r in
    select polname from pg_policy
    where polrelid = 'public.prospects'::regclass
      and polname <> 'tenant_isolation_restrictive'
  loop
    execute format('drop policy if exists %I on public.prospects', r.polname);
  end loop;
end$$;

-- 4) Policy única: qualquer membro autenticado da org pode ler/escrever.
--    O isolamento entre orgs continua garantido pela policy RESTRICTIVE
--    tenant_isolation_restrictive criada por _apply_tenant_isolation.
create policy prospects_org_all
  on public.prospects
  for all
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- 5) Default de user_id em novos INSERTs (compatibilidade com código legado
--    que ainda seta user_id = auth.uid()).
alter table public.prospects alter column user_id drop not null;

notify pgrst, 'reload schema';