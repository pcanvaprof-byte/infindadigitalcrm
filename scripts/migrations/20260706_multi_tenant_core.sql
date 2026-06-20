-- ============================================================================
-- FASE 0.1 — Multi-Tenant Core (INFINDA SaaS)
-- Estratégia: ADITIVA. Não apaga dados, não muda lógica de negócio.
-- Adiciona organization_id + RLS de isolamento como camada RESTRICTIVE
-- (combinada via AND com as políticas existentes baseadas em papel).
-- ============================================================================

-- 1) Tabela de organizações ---------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;

alter table public.organizations enable row level security;

-- Membros podem ver a própria org (policy criada após organization_members)

-- 2) Membros ----------------------------------------------------------------
create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists idx_org_members_user on public.organization_members(user_id);

grant select on public.organization_members to authenticated;
grant all on public.organization_members to service_role;

alter table public.organization_members enable row level security;

drop policy if exists "members_view_own" on public.organization_members;
create policy "members_view_own" on public.organization_members
  for select to authenticated
  using (user_id = auth.uid());

-- 3) Org ativa por usuário ---------------------------------------------------
create table if not exists public.user_active_org (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.user_active_org to authenticated;
grant all on public.user_active_org to service_role;

alter table public.user_active_org enable row level security;

drop policy if exists "active_org_self_select" on public.user_active_org;
create policy "active_org_self_select" on public.user_active_org
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "active_org_self_upsert" on public.user_active_org;
create policy "active_org_self_upsert" on public.user_active_org
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members
      where organization_id = user_active_org.organization_id
        and user_id = auth.uid()
    )
  );

drop policy if exists "active_org_self_update" on public.user_active_org;
create policy "active_org_self_update" on public.user_active_org
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.organization_members
      where organization_id = user_active_org.organization_id
        and user_id = auth.uid()
    )
  );

-- 4) Org padrão INFINDA + vínculo dos usuários existentes --------------------
do $$
declare
  v_org uuid;
  v_user record;
begin
  -- pega ou cria a org INFINDA
  select id into v_org from public.organizations where name = 'INFINDA' limit 1;
  if v_org is null then
    insert into public.organizations (name, slug) values ('INFINDA','infinda')
    returning id into v_org;
  end if;

  -- todo auth.user vira membro de INFINDA (idempotente)
  for v_user in select id from auth.users loop
    insert into public.organization_members(organization_id, user_id, role)
    values (v_org, v_user.id, 'owner')
    on conflict (organization_id, user_id) do nothing;

    insert into public.user_active_org(user_id, organization_id)
    values (v_user.id, v_org)
    on conflict (user_id) do nothing;
  end loop;
end$$;

-- Agora pode criar a policy de SELECT em organizations
drop policy if exists "orgs_member_select" on public.organizations;
create policy "orgs_member_select" on public.organizations
  for select to authenticated
  using (
    exists (
      select 1 from public.organization_members
      where organization_id = organizations.id and user_id = auth.uid()
    )
  );

-- 5) current_org_id() --------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.user_active_org
  where user_id = auth.uid()
$$;

grant execute on function public.current_org_id() to authenticated, anon, service_role;

-- 6) Trigger: novo usuário entra em INFINDA + define org ativa ---------------
create or replace function public.handle_new_user_default_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select id into v_org from public.organizations where name = 'INFINDA' limit 1;
  if v_org is null then return new; end if;

  insert into public.organization_members(organization_id, user_id, role)
  values (v_org, new.id, 'member')
  on conflict do nothing;

  insert into public.user_active_org(user_id, organization_id)
  values (new.id, v_org)
  on conflict do nothing;

  return new;
end$$;

drop trigger if exists on_auth_user_created_default_org on auth.users;
create trigger on_auth_user_created_default_org
  after insert on auth.users
  for each row execute function public.handle_new_user_default_org();

-- 7) Helper: aplica organization_id + RLS em uma tabela -----------------------
create or replace function public._apply_tenant_isolation(p_table text)
returns void
language plpgsql
as $$
declare
  v_org uuid;
  v_exists boolean;
  v_has_col boolean;
begin
  select to_regclass('public.'||p_table) is not null into v_exists;
  if not v_exists then
    raise notice 'skip %: tabela inexistente', p_table;
    return;
  end if;

  select id into v_org from public.organizations where name = 'INFINDA' limit 1;

  -- coluna
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name=p_table and column_name='organization_id'
  ) into v_has_col;

  if not v_has_col then
    execute format('alter table public.%I add column organization_id uuid references public.organizations(id)', p_table);
  end if;

  -- backfill
  execute format('update public.%I set organization_id = %L where organization_id is null', p_table, v_org);

  -- not null
  execute format('alter table public.%I alter column organization_id set not null', p_table);

  -- default para INSERTs simples manuais
  execute format('alter table public.%I alter column organization_id set default public.current_org_id()', p_table);

  -- índice
  execute format('create index if not exists %I on public.%I(organization_id)',
                 'idx_'||p_table||'_org', p_table);

  -- garante RLS ligado
  execute format('alter table public.%I enable row level security', p_table);

  -- política RESTRICTIVE: AND com qualquer policy existente
  execute format('drop policy if exists tenant_isolation_restrictive on public.%I', p_table);
  execute format($p$
    create policy tenant_isolation_restrictive on public.%I
    as restrictive
    for all to authenticated, anon
    using (organization_id = public.current_org_id())
    with check (organization_id = public.current_org_id())
  $p$, p_table);
end$$;

-- 8) Aplicar em todas as tabelas de negócio existentes ------------------------
do $$
declare
  t text;
  business_tables text[] := array[
    'clients', 'client_financials',
    'proposals', 'proposal_items', 'proposal_attachments', 'proposal_versions',
    'proposal_events', 'proposal_views', 'proposal_sends', 'proposal_approvals',
    'proposal_commissions', 'proposal_discount_logs', 'proposal_item_decisions',
    'proposal_loss_reasons',
    'contracts', 'contract_signatures',
    'contratos', 'contrato_documentos', 'contrato_eventos',
    'deals', 'deal_stages', 'deal_activities',
    'catalog_categorias', 'catalog_items', 'catalog_relacionamentos',
    'financeiro_previsto',
    'prospect_touchpoints',
    'activity_logs'
  ];
begin
  foreach t in array business_tables loop
    perform public._apply_tenant_isolation(t);
  end loop;
end$$;

-- 9) Helpers para o frontend -------------------------------------------------
-- lista as organizações do usuário atual
create or replace function public.my_organizations()
returns table (id uuid, name text, slug text, role text, is_active boolean)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.slug, m.role,
         (uao.organization_id = o.id) as is_active
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  left join public.user_active_org uao on uao.user_id = auth.uid()
  where m.user_id = auth.uid()
  order by o.name
$$;

grant execute on function public.my_organizations() to authenticated;

-- troca atômica de org ativa
create or replace function public.set_active_org(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org and user_id = auth.uid()
  ) then
    raise exception 'not a member of organization %', p_org using errcode = '42501';
  end if;

  insert into public.user_active_org(user_id, organization_id)
  values (auth.uid(), p_org)
  on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        updated_at = now();
end$$;

grant execute on function public.set_active_org(uuid) to authenticated;

-- ============================================================================
-- FIM. Sistema continua funcionando idêntico (todos pertencem a INFINDA).
-- A partir de agora qualquer linha inserida sem organization_id é rejeitada
-- pela policy RESTRICTIVE; o DEFAULT current_org_id() resolve a maioria dos
-- INSERTs legados sem mudar código.
-- ============================================================================
