-- 20260745 — ONDA 4: Multiusuario, equipes, metas granulares, ranking de equipes, alertas
-- Aditivo. NAO altera v7 nem dados existentes. Aplique apos 20260744.

begin;

-- =========================================================
-- 1) Papeis: estender enum app_role
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
                 where t.typname='app_role' and e.enumlabel='vendedor') then
    alter type public.app_role add value 'vendedor';
  end if;
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
                 where t.typname='app_role' and e.enumlabel='diretor') then
    alter type public.app_role add value 'diretor';
  end if;
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
                 where t.typname='app_role' and e.enumlabel='supervisor') then
    alter type public.app_role add value 'supervisor';
  end if;
end$$;

commit;

begin;

-- =========================================================
-- 2) Equipes
-- =========================================================
create table if not exists public.teams (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  created_at      timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.team_members (
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  owner_name  text,  -- nome usado em prospect_touchpoints/clients para reconciliacao
  team_role   text not null default 'member' check (team_role in ('lider','supervisor','member')),
  created_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists idx_team_members_user        on public.team_members(user_id);
create index if not exists idx_team_members_owner_name  on public.team_members(owner_name);
create index if not exists idx_teams_org                on public.teams(organization_id);

grant select, insert, update, delete on public.teams        to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.teams        to service_role;
grant all on public.team_members to service_role;

alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

drop policy if exists teams_org_read   on public.teams;
drop policy if exists teams_org_write  on public.teams;
create policy teams_org_read  on public.teams for select using (organization_id = public.current_org_id());
create policy teams_org_write on public.teams for all
  using (organization_id = public.current_org_id() and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'diretor')))
  with check (organization_id = public.current_org_id());

drop policy if exists tmemb_read   on public.team_members;
drop policy if exists tmemb_write  on public.team_members;
create policy tmemb_read on public.team_members for select using (
  exists (select 1 from public.teams t where t.id = team_id and t.organization_id = public.current_org_id())
);
create policy tmemb_write on public.team_members for all using (
  exists (select 1 from public.teams t
    where t.id = team_id and t.organization_id = public.current_org_id()
      and (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'gestor') or public.has_role(auth.uid(),'diretor'))
  )
) with check (
  exists (select 1 from public.teams t where t.id = team_id and t.organization_id = public.current_org_id())
);

-- =========================================================
-- 3) Metas granulares
-- =========================================================
alter table public.org_goals add column if not exists meta_propostas  int     not null default 0;
alter table public.org_goals add column if not exists meta_reunioes   int     not null default 0;
alter table public.org_goals add column if not exists meta_conversao  numeric not null default 0; -- %

create table if not exists public.team_goals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id         uuid not null references public.teams(id) on delete cascade,
  year            int  not null,
  month           int  not null check (month between 1 and 12),
  meta_receita    numeric not null default 0,
  meta_clientes   int     not null default 0,
  meta_contatos   int     not null default 0,
  meta_propostas  int     not null default 0,
  meta_reunioes   int     not null default 0,
  meta_conversao  numeric not null default 0,
  updated_at      timestamptz not null default now(),
  unique (organization_id, team_id, year, month)
);

create table if not exists public.user_goals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  owner_name      text,
  year            int  not null,
  month           int  not null check (month between 1 and 12),
  meta_receita    numeric not null default 0,
  meta_clientes   int     not null default 0,
  meta_contatos   int     not null default 0,
  meta_propostas  int     not null default 0,
  meta_reunioes   int     not null default 0,
  meta_conversao  numeric not null default 0,
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id, year, month)
);

grant select, insert, update, delete on public.team_goals to authenticated;
grant select, insert, update, delete on public.user_goals to authenticated;
grant all on public.team_goals to service_role;
grant all on public.user_goals to service_role;

alter table public.team_goals enable row level security;
alter table public.user_goals enable row level security;

drop policy if exists team_goals_rw on public.team_goals;
create policy team_goals_rw on public.team_goals for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists user_goals_rw on public.user_goals;
create policy user_goals_rw on public.user_goals for all
  using (
    organization_id = public.current_org_id() and (
      user_id = auth.uid()
      or public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'gestor')
      or public.has_role(auth.uid(),'diretor')
    )
  )
  with check (organization_id = public.current_org_id());

-- =========================================================
-- 4) Alertas
-- =========================================================
create table if not exists public.dashboard_alerts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind            text not null check (kind in (
    'queda_conversao','vendedor_sem_atividade','meta_em_risco',
    'pipeline_parado','cliente_sem_followup'
  )),
  severity        text not null default 'warn' check (severity in ('info','warn','danger')),
  scope           text not null default 'org' check (scope in ('org','team','user','client')),
  scope_ref       text,            -- team_id / owner_name / client_id / etc.
  title           text not null,
  detail          text,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

-- UNIQUE com expressão precisa ser índice (Postgres não aceita
-- expressões em UNIQUE de tabela). COALESCE garante dedupe quando
-- scope_ref é NULL (NULLs não colidem em índices únicos comuns).
-- `date(timestamptz)` depende do TimeZone da sessão -> não é IMMUTABLE
-- e o Postgres recusa em índices. Forçamos UTC para tornar imutável.
create unique index if not exists dashboard_alerts_dedupe_idx
  on public.dashboard_alerts (
    organization_id, kind, scope, coalesce(scope_ref, ''),
    ((created_at at time zone 'UTC')::date)
  );

create index if not exists idx_alerts_org_open
  on public.dashboard_alerts(organization_id, created_at desc) where resolved_at is null;

grant select, insert, update, delete on public.dashboard_alerts to authenticated;
grant all on public.dashboard_alerts to service_role;

alter table public.dashboard_alerts enable row level security;
drop policy if exists alerts_org_rw on public.dashboard_alerts;
create policy alerts_org_rw on public.dashboard_alerts for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- =========================================================
-- 5) Helper: escopo do usuario logado
-- =========================================================
create or replace function public.current_user_scope()
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_org  uuid := public.current_org_id();
  v_role text;
  v_teams uuid[];
  v_owners text[];
  v_my_owner text;
begin
  if v_uid is null or v_org is null then
    return jsonb_build_object('role','none','teams','[]'::jsonb,'owners','[]'::jsonb);
  end if;

  select case
    when public.has_role(v_uid,'admin')      then 'admin'
    when public.has_role(v_uid,'diretor')    then 'diretor'
    when public.has_role(v_uid,'gestor')     then 'gestor'
    when public.has_role(v_uid,'supervisor') then 'supervisor'
    when public.has_role(v_uid,'vendedor')   then 'vendedor'
    when public.has_role(v_uid,'consultor')  then 'vendedor'
    else 'vendedor'
  end into v_role;

  select array_agg(team_id) into v_teams
    from public.team_members where user_id = v_uid;

  if v_role in ('gestor','supervisor') and v_teams is not null then
    select array_agg(distinct owner_name) into v_owners
      from public.team_members
     where team_id = any(v_teams) and owner_name is not null;
  end if;

  select owner_name into v_my_owner
    from public.team_members where user_id = v_uid and owner_name is not null limit 1;

  return jsonb_build_object(
    'org_id',   v_org,
    'user_id',  v_uid,
    'role',     v_role,
    'teams',    coalesce(to_jsonb(v_teams),  '[]'::jsonb),
    'owners',   coalesce(to_jsonb(v_owners), '[]'::jsonb),
    'my_owner', v_my_owner
  );
end$$;

grant execute on function public.current_user_scope() to authenticated;

-- =========================================================
-- 6) RPC v8: aplica escopo por papel, depois delega para v7
-- =========================================================
create or replace function public.dashboard_metrics_v8(filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare
  v_scope jsonb := public.current_user_scope();
  v_role  text  := v_scope->>'role';
  v_owner text  := filters->>'owner_name';
  v_team  text  := filters->>'team_id';
  v_owners text[];
  v_base  jsonb;
  v_filtered jsonb := filters;
begin
  -- Vendedor: forca escopo proprio
  if v_role in ('vendedor','consultor') then
    v_owner := coalesce(v_owner, v_scope->>'my_owner');
    if v_owner is null then
      -- sem owner_name vinculado: retorna vazio mas valido
      v_filtered := v_filtered || jsonb_build_object('owner_name','__nobody__');
    else
      v_filtered := v_filtered || jsonb_build_object('owner_name', v_owner);
    end if;
  end if;

  -- Gestor/supervisor: limita por equipe (se filtro de team_id explicito) ou pelos owners das suas equipes
  if v_role in ('gestor','supervisor') and v_team is not null then
    select array_agg(distinct owner_name) into v_owners
      from public.team_members where team_id::text = v_team and owner_name is not null;
    if v_owners is not null and array_length(v_owners,1) >= 1 then
      -- v7 so aceita 1 owner_name; aplicamos o primeiro e devolvemos lista para o frontend filtrar
      v_filtered := v_filtered || jsonb_build_object('owner_name', v_owners[1]);
    end if;
  end if;

  v_base := public.dashboard_metrics_v7(v_filtered);

  return v_base
      || jsonb_build_object(
        'schema',     'v8',
        'scope',      v_scope,
        'owners_in_scope', coalesce(to_jsonb(v_owners), v_scope->'owners')
      );
end$$;

grant execute on function public.dashboard_metrics_v8(jsonb) to authenticated;

-- =========================================================
-- 7) Ranking de equipes
-- =========================================================
create or replace function public.ranking_teams(filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable security definer set search_path = public
as $$
declare
  v_org   uuid := public.current_org_id();
  v_from  timestamptz := coalesce((filters->>'from')::timestamptz, date_trunc('month', now()));
  v_to    timestamptz := coalesce((filters->>'to')::timestamptz,   now() + interval '1 day');
  v_result jsonb;
begin
  if v_org is null then
    raise exception 'no_active_org' using errcode = '28000';
  end if;

  with tm as (
    select t.id as team_id, t.name as team_name, tm.owner_name
      from public.teams t
      join public.team_members tm on tm.team_id = t.id
     where t.organization_id = v_org and tm.owner_name is not null
  ),
  agg as (
    select tm.team_id, tm.team_name,
           count(*) filter (where pt.kind='whatsapp_out' and pt.created_at between v_from and v_to) as contatos,
           count(*) filter (where pt.kind='whatsapp_in'  and pt.created_at between v_from and v_to) as respostas
      from tm
 left join public.prospects p on p.organization_id = v_org and p.owner_name = tm.owner_name
 left join public.prospect_touchpoints pt on pt.prospect_id = p.id
     group by tm.team_id, tm.team_name
  ),
  cli as (
    select tm.team_id,
           count(*) filter (where c.pipeline_stage = 'ativo'   and c.updated_at between v_from and v_to) as ganhos,
           count(*) filter (where c.pipeline_stage = 'perdido' and c.updated_at between v_from and v_to) as perdidos,
           coalesce(sum(c.contract_value) filter (where c.pipeline_stage = 'ativo' and c.updated_at between v_from and v_to),0) as receita
      from tm
 left join public.clients c on c.organization_id = v_org and c.owner_name = tm.owner_name
     group by tm.team_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'team_id',   a.team_id,
    'team_name', a.team_name,
    'contatos',  a.contatos,
    'respostas', a.respostas,
    'ganhos',    coalesce(c.ganhos,0),
    'perdidos',  coalesce(c.perdidos,0),
    'receita',   coalesce(c.receita,0)
  ) order by coalesce(c.receita,0) desc, a.contatos desc), '[]'::jsonb)
    into v_result
    from agg a left join cli c on c.team_id = a.team_id;

  return jsonb_build_object('teams', v_result);
end$$;

grant execute on function public.ranking_teams(jsonb) to authenticated;

-- =========================================================
-- 8) Upserts de metas
-- =========================================================
create or replace function public.upsert_team_goal(
  p_team_id uuid, p_year int, p_month int,
  p_meta_receita numeric, p_meta_clientes int, p_meta_contatos int,
  p_meta_propostas int, p_meta_reunioes int, p_meta_conversao numeric
) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id();
begin
  if v_org is null then raise exception 'no_active_org' using errcode='28000'; end if;
  insert into public.team_goals(organization_id,team_id,year,month,
    meta_receita,meta_clientes,meta_contatos,meta_propostas,meta_reunioes,meta_conversao)
  values (v_org,p_team_id,p_year,p_month,
    p_meta_receita,p_meta_clientes,p_meta_contatos,p_meta_propostas,p_meta_reunioes,p_meta_conversao)
  on conflict (organization_id,team_id,year,month) do update set
    meta_receita=excluded.meta_receita, meta_clientes=excluded.meta_clientes,
    meta_contatos=excluded.meta_contatos, meta_propostas=excluded.meta_propostas,
    meta_reunioes=excluded.meta_reunioes, meta_conversao=excluded.meta_conversao,
    updated_at=now();
end$$;

create or replace function public.upsert_user_goal(
  p_user_id uuid, p_owner_name text, p_year int, p_month int,
  p_meta_receita numeric, p_meta_clientes int, p_meta_contatos int,
  p_meta_propostas int, p_meta_reunioes int, p_meta_conversao numeric
) returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id();
begin
  if v_org is null then raise exception 'no_active_org' using errcode='28000'; end if;
  insert into public.user_goals(organization_id,user_id,owner_name,year,month,
    meta_receita,meta_clientes,meta_contatos,meta_propostas,meta_reunioes,meta_conversao)
  values (v_org,p_user_id,p_owner_name,p_year,p_month,
    p_meta_receita,p_meta_clientes,p_meta_contatos,p_meta_propostas,p_meta_reunioes,p_meta_conversao)
  on conflict (organization_id,user_id,year,month) do update set
    owner_name=excluded.owner_name,
    meta_receita=excluded.meta_receita, meta_clientes=excluded.meta_clientes,
    meta_contatos=excluded.meta_contatos, meta_propostas=excluded.meta_propostas,
    meta_reunioes=excluded.meta_reunioes, meta_conversao=excluded.meta_conversao,
    updated_at=now();
end$$;

grant execute on function public.upsert_team_goal(uuid,int,int,numeric,int,int,int,int,numeric) to authenticated;
grant execute on function public.upsert_user_goal(uuid,text,int,int,numeric,int,int,int,int,numeric) to authenticated;

-- =========================================================
-- 9) Motor de alertas
-- =========================================================
create or replace function public.compute_dashboard_alerts(p_org uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_count int := 0;
  v_org uuid;
  v_now timestamptz := now();
begin
  for v_org in
    select id from public.organizations where (p_org is null or id = p_org)
  loop
    -- (a) Vendedor sem atividade (sem touchpoint outbound nos ultimos 3 dias) — entre membros de equipes
    for r in
      select distinct tm.owner_name
        from public.team_members tm
        join public.teams t on t.id = tm.team_id
       where t.organization_id = v_org and tm.owner_name is not null
         and not exists (
           select 1 from public.prospects p
             join public.prospect_touchpoints pt on pt.prospect_id = p.id
            where p.organization_id = v_org and p.owner_name = tm.owner_name
              and pt.kind = 'whatsapp_out'
              and pt.created_at >= v_now - interval '3 days'
         )
    loop
      insert into public.dashboard_alerts(organization_id,kind,severity,scope,scope_ref,title,detail,payload)
      values (v_org,'vendedor_sem_atividade','warn','user',r.owner_name,
              format('Vendedor sem atividade: %s', r.owner_name),
              'Nenhum disparo nos ultimos 3 dias.', '{}'::jsonb)
      on conflict do nothing;
      v_count := v_count + 1;
    end loop;

    -- (b) Cliente sem follow-up (clients ativos sem touchpoint > 14 dias)
    for r in
      select c.id, c.empresa, c.owner_name
        from public.clients c
       where c.organization_id = v_org and c.pipeline_stage = 'ativo'
         and not exists (
           select 1 from public.prospect_touchpoints pt
            where pt.prospect_id = c.prospect_id
              and pt.created_at >= v_now - interval '14 days'
         )
    loop
      insert into public.dashboard_alerts(organization_id,kind,severity,scope,scope_ref,title,detail,payload)
      values (v_org,'cliente_sem_followup','warn','client', r.id::text,
              format('Cliente sem follow-up: %s', coalesce(r.empresa,'(sem nome)')),
              format('Responsavel: %s', coalesce(r.owner_name,'-')),
              jsonb_build_object('client_id', r.id, 'owner_name', r.owner_name))
      on conflict do nothing;
      v_count := v_count + 1;
    end loop;

    -- (c) Pipeline parado: prospects em 'qualificacao' parados > 21 dias
    for r in
      select count(*)::int as n
        from public.prospects
       where organization_id = v_org
         and status = 'qualificacao'
         and updated_at < v_now - interval '21 days'
    loop
      if r.n >= 5 then
        insert into public.dashboard_alerts(organization_id,kind,severity,scope,scope_ref,title,detail,payload)
        values (v_org,'pipeline_parado','danger','org',null,
                format('%s prospects parados em qualificacao', r.n),
                'Mais de 21 dias sem progresso.', jsonb_build_object('total', r.n))
        on conflict do nothing;
        v_count := v_count + 1;
      end if;
    end loop;

    -- (d) Queda de conversao: ganhos do mes corrente < 50% da media dos 3 meses anteriores
    for r in
      with cur as (
        select count(*)::int as n from public.clients
         where organization_id = v_org and pipeline_stage = 'ativo'
           and updated_at >= date_trunc('month', v_now)
      ), prev as (
        select count(*)::numeric / 3.0 as n from public.clients
         where organization_id = v_org and pipeline_stage = 'ativo'
           and updated_at >= date_trunc('month', v_now) - interval '3 months'
           and updated_at <  date_trunc('month', v_now)
      )
      select cur.n as atual, prev.n as media from cur, prev
    loop
      if r.media >= 4 and r.atual < r.media * 0.5 then
        insert into public.dashboard_alerts(organization_id,kind,severity,scope,scope_ref,title,detail,payload)
        values (v_org,'queda_conversao','danger','org',null,
                'Queda de conversao detectada',
                format('Ganhos do mes: %s | media 3m: %.1f', r.atual, r.media),
                jsonb_build_object('atual', r.atual, 'media_3m', r.media))
        on conflict do nothing;
        v_count := v_count + 1;
      end if;
    end loop;

    -- (e) Meta em risco: faltam <= 7 dias do mes e <70% da meta_clientes
    for r in
      select og.meta_clientes,
             (select count(*) from public.clients c
               where c.organization_id = v_org and c.pipeline_stage='ativo'
                 and c.updated_at >= date_trunc('month', v_now))::int as feitos,
             (date_trunc('month', v_now) + interval '1 month' - v_now) as restante
        from public.org_goals og
       where og.organization_id = v_org
         and og.year  = extract(year  from v_now)::int
         and og.month = extract(month from v_now)::int
    loop
      if r.meta_clientes > 0 and r.restante <= interval '7 days'
         and r.feitos::numeric < r.meta_clientes * 0.7 then
        insert into public.dashboard_alerts(organization_id,kind,severity,scope,scope_ref,title,detail,payload)
        values (v_org,'meta_em_risco','danger','org',null,
                'Meta de clientes em risco',
                format('%s de %s no mes', r.feitos, r.meta_clientes),
                jsonb_build_object('feitos', r.feitos, 'meta', r.meta_clientes))
        on conflict do nothing;
        v_count := v_count + 1;
      end if;
    end loop;

  end loop;

  return v_count;
exception when others then
  return v_count;
end$$;

grant execute on function public.compute_dashboard_alerts(uuid) to authenticated;

-- =========================================================
-- 10) RPCs auxiliares para o frontend
-- =========================================================
create or replace function public.list_active_alerts()
returns setof public.dashboard_alerts
language sql stable security definer set search_path = public as $$
  select * from public.dashboard_alerts
   where organization_id = public.current_org_id() and resolved_at is null
   order by case severity when 'danger' then 0 when 'warn' then 1 else 2 end, created_at desc
   limit 100;
$$;
grant execute on function public.list_active_alerts() to authenticated;

create or replace function public.resolve_alert(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.dashboard_alerts
     set resolved_at = now()
   where id = p_id and organization_id = public.current_org_id();
$$;
grant execute on function public.resolve_alert(uuid) to authenticated;

-- =========================================================
-- 11) pg_cron: alertas diarios as 06:30 UTC
-- =========================================================
do $$ begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule('dashboard_alerts_daily')
      where exists (select 1 from cron.job where jobname='dashboard_alerts_daily');
    perform cron.schedule('dashboard_alerts_daily','30 6 * * *',
      $cron$ select public.compute_dashboard_alerts(); $cron$);
  end if;
exception when others then null;
end $$;

notify pgrst, 'reload schema';

commit;