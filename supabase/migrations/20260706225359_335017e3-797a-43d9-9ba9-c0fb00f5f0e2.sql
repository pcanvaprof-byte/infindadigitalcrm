-- Fase A: colunas em clients
alter table public.clients add column if not exists contract_term_months integer;
alter table public.clients add column if not exists site_one_time_value numeric(14,2);
alter table public.clients add column if not exists site_recurring_value numeric(14,2);
alter table public.clients add column if not exists permuta_value numeric(14,2);

-- log_evt
create or replace function public.log_evt(p_proposal_id uuid, p_tipo text, p_payload jsonb default '{}'::jsonb, p_actor_type text default 'system')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tipo text := case when p_tipo ~ '^evt_' then p_tipo else 'evt_' || p_tipo end;
begin
  insert into public.proposal_events(proposal_id, tipo, actor_id, actor_type, payload)
  values (p_proposal_id, v_tipo, auth.uid(), p_actor_type, coalesce(p_payload,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.log_evt(uuid, text, jsonb, text) to authenticated;

-- Trigger helper op_*
create or replace function public.op_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Enums Operações
do $$ begin create type public.op_cliente_status as enum ('ativo','pausado','offboarding','encerrado'); exception when duplicate_object then null; end $$;
do $$ begin create type public.op_plataforma as enum ('meta_ads','google_ads','tiktok_ads','linkedin_ads'); exception when duplicate_object then null; end $$;
do $$ begin create type public.op_entrega_status as enum ('backlog','em_andamento','revisao','entregue'); exception when duplicate_object then null; end $$;
do $$ begin create type public.op_entrega_tipo as enum ('criativo','relatorio','otimizacao','reuniao','outro'); exception when duplicate_object then null; end $$;

-- op_clientes
create table if not exists public.op_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null, empresa text, email text, telefone text, whatsapp text,
  status public.op_cliente_status not null default 'ativo',
  responsavel_id uuid references auth.users(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.op_clientes to authenticated;
grant all on public.op_clientes to service_role;
alter table public.op_clientes enable row level security;
drop policy if exists op_clientes_all on public.op_clientes;
create policy op_clientes_all on public.op_clientes for all to authenticated using (true) with check (true);
drop trigger if exists trg_op_clientes_updated on public.op_clientes;
create trigger trg_op_clientes_updated before update on public.op_clientes for each row execute function public.op_set_updated_at();
create index if not exists idx_op_clientes_status on public.op_clientes(status);

-- op_trafego_contas
create table if not exists public.op_trafego_contas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.op_clientes(id) on delete cascade,
  plataforma public.op_plataforma not null,
  nome_conta text not null, conta_id_externa text,
  verba_mensal numeric(14,2) default 0, objetivo text,
  status text not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.op_trafego_contas to authenticated;
grant all on public.op_trafego_contas to service_role;
alter table public.op_trafego_contas enable row level security;
drop policy if exists op_trafego_contas_all on public.op_trafego_contas;
create policy op_trafego_contas_all on public.op_trafego_contas for all to authenticated using (true) with check (true);
drop trigger if exists trg_op_trafego_contas_updated on public.op_trafego_contas;
create trigger trg_op_trafego_contas_updated before update on public.op_trafego_contas for each row execute function public.op_set_updated_at();
create index if not exists idx_op_trafego_contas_cliente on public.op_trafego_contas(cliente_id);

-- op_trafego_campanhas
create table if not exists public.op_trafego_campanhas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.op_clientes(id) on delete cascade,
  conta_id uuid references public.op_trafego_contas(id) on delete set null,
  plataforma public.op_plataforma not null,
  nome text not null, status text not null default 'ativa',
  verba numeric(14,2) default 0, gasto numeric(14,2) default 0,
  impressoes bigint default 0, cliques bigint default 0, conversoes bigint default 0,
  cpa numeric(14,2) default 0, roas numeric(8,2) default 0,
  periodo_inicio date, periodo_fim date, ultima_sync timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.op_trafego_campanhas to authenticated;
grant all on public.op_trafego_campanhas to service_role;
alter table public.op_trafego_campanhas enable row level security;
drop policy if exists op_trafego_campanhas_all on public.op_trafego_campanhas;
create policy op_trafego_campanhas_all on public.op_trafego_campanhas for all to authenticated using (true) with check (true);
drop trigger if exists trg_op_trafego_campanhas_updated on public.op_trafego_campanhas;
create trigger trg_op_trafego_campanhas_updated before update on public.op_trafego_campanhas for each row execute function public.op_set_updated_at();
create index if not exists idx_op_trafego_camp_cliente on public.op_trafego_campanhas(cliente_id);

-- op_entregas
create table if not exists public.op_entregas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.op_clientes(id) on delete set null,
  titulo text not null,
  tipo public.op_entrega_tipo not null default 'outro',
  responsavel_id uuid references auth.users(id) on delete set null,
  status public.op_entrega_status not null default 'backlog',
  prazo date, descricao text, ordem int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.op_entregas to authenticated;
grant all on public.op_entregas to service_role;
alter table public.op_entregas enable row level security;
drop policy if exists op_entregas_all on public.op_entregas;
create policy op_entregas_all on public.op_entregas for all to authenticated using (true) with check (true);
drop trigger if exists trg_op_entregas_updated on public.op_entregas;
create trigger trg_op_entregas_updated before update on public.op_entregas for each row execute function public.op_set_updated_at();
create index if not exists idx_op_entregas_status on public.op_entregas(status);
create index if not exists idx_op_entregas_cliente on public.op_entregas(cliente_id);

-- op_client_interactions
create table if not exists public.op_client_interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.op_clientes(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  interaction_type text not null check (interaction_type in ('WhatsApp','Ligação','Reunião','E-mail','Suporte','Solicitação')),
  title text not null, notes text,
  interaction_date timestamptz not null default now(),
  next_followup_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.op_client_interactions to authenticated;
grant all on public.op_client_interactions to service_role;
alter table public.op_client_interactions enable row level security;
drop policy if exists op_client_interactions_owner on public.op_client_interactions;
create policy op_client_interactions_owner on public.op_client_interactions
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists idx_op_inter_client on public.op_client_interactions(client_id);
create index if not exists idx_op_inter_owner on public.op_client_interactions(owner_id);
create index if not exists idx_op_inter_date on public.op_client_interactions(interaction_date desc);
create index if not exists idx_op_inter_followup on public.op_client_interactions(next_followup_at);

-- Cadência notifications (tabela + view + 3 RPCs)
do $$ begin create type public.cad_notif_kind as enum ('overdue','last_attempt','response_pending'); exception when duplicate_object then null; end $$;
create table if not exists public.cad_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.cad_leads(id) on delete cascade,
  kind public.cad_notif_kind not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references auth.users(id) on delete set null
);
create index if not exists idx_cad_notif_org on public.cad_notifications(organization_id, handled_at);
create index if not exists idx_cad_notif_lead on public.cad_notifications(lead_id);
create unique index if not exists ux_cad_notif_pending on public.cad_notifications(lead_id, kind) where handled_at is null;
grant select, insert, update, delete on public.cad_notifications to authenticated;
grant all on public.cad_notifications to service_role;
alter table public.cad_notifications enable row level security;
drop policy if exists cad_notif_select on public.cad_notifications;
create policy cad_notif_select on public.cad_notifications for select to authenticated using (organization_id = public.current_org_id());
drop policy if exists cad_notif_write on public.cad_notifications;
create policy cad_notif_write on public.cad_notifications for all to authenticated
  using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());

create or replace function public.cad_refresh_notifications() returns int
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.current_org_id(); v_count int := 0; v_added int := 0;
begin
  if v_org is null then return 0; end if;
  insert into public.cad_notifications (organization_id, lead_id, kind, payload)
  select v_org, l.id, 'overdue', jsonb_build_object('stage', l.stage::text, 'next_action_at', l.next_action_at, 'empresa', l.empresa)
  from public.cad_leads l
  where l.organization_id = v_org and l.stage::text like 'followup_%' and l.stage <> 'followup_7'
    and l.closed_at is null and l.next_action_at is not null and l.next_action_at < now()
    and not exists (select 1 from public.cad_notifications n where n.lead_id = l.id and n.kind = 'overdue' and n.handled_at is null);
  get diagnostics v_added = row_count; v_count := v_count + v_added;
  insert into public.cad_notifications (organization_id, lead_id, kind, payload)
  select v_org, l.id, 'last_attempt', jsonb_build_object('next_action_at', l.next_action_at, 'empresa', l.empresa)
  from public.cad_leads l
  where l.organization_id = v_org and l.stage = 'followup_7' and l.closed_at is null
    and (l.next_action_at is null or l.next_action_at < now())
    and not exists (select 1 from public.cad_notifications n where n.lead_id = l.id and n.kind = 'last_attempt' and n.handled_at is null);
  get diagnostics v_added = row_count; v_count := v_count + v_added;
  insert into public.cad_notifications (organization_id, lead_id, kind, payload)
  select v_org, l.id, 'response_pending', jsonb_build_object('last_response_at', l.last_response_at, 'empresa', l.empresa)
  from public.cad_leads l
  where l.organization_id = v_org and l.closed_at is null and l.last_response_at is not null
    and not exists (select 1 from public.cad_messages m where m.lead_id = l.id and m.direction = 'out' and m.created_at > l.last_response_at)
    and not exists (select 1 from public.cad_notifications n where n.lead_id = l.id and n.kind = 'response_pending' and n.handled_at is null);
  get diagnostics v_added = row_count; v_count := v_count + v_added;
  return v_count;
end $$;
grant execute on function public.cad_refresh_notifications() to authenticated;

create or replace function public.cad_mark_notification_handled(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.cad_notifications set handled_at = now(), handled_by = auth.uid()
   where id = p_id and handled_at is null;
end $$;
grant execute on function public.cad_mark_notification_handled(uuid) to authenticated;

create or replace function public.cad_mark_all_notifications_handled() returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  update public.cad_notifications set handled_at = now(), handled_by = auth.uid()
   where organization_id = public.current_org_id() and handled_at is null;
  get diagnostics v_count = row_count; return v_count;
end $$;
grant execute on function public.cad_mark_all_notifications_handled() to authenticated;

drop view if exists public.cad_notifications_v;
create view public.cad_notifications_v with (security_invoker = true) as
select n.id, n.organization_id, n.lead_id, n.kind, n.payload, n.created_at, n.handled_at,
       l.empresa, l.responsavel, l.telefone, l.whatsapp,
       l.stage, l.next_action_at, l.last_response_at, l.temperatura
  from public.cad_notifications n join public.cad_leads l on l.id = n.lead_id;
grant select on public.cad_notifications_v to authenticated;

-- Cadência série 30d
create or replace function public.cad_metrics_serie_30d()
returns table(dia date, enviadas bigint, respostas bigint)
language sql stable security definer set search_path = public as $$
  with dias as (select (current_date - i)::date as dia from generate_series(0, 29) as i),
  agg as (
    select date_trunc('day', m.created_at)::date as dia,
           count(*) filter (where m.direction <> 'in') as enviadas,
           count(*) filter (where m.direction = 'in') as respostas
    from public.cad_messages m
    where m.created_at >= (current_date - interval '29 days')
      and m.organization_id = public.current_org_id()
    group by 1
  )
  select d.dia, coalesce(a.enviadas, 0), coalesce(a.respostas, 0)
  from dias d left join agg a using (dia) order by d.dia asc;
$$;
grant execute on function public.cad_metrics_serie_30d() to authenticated;

-- Cadência followup comparativo
create or replace function public.cadencia_followup_comparativo(_days int default 14)
returns table(dia date, previstos int, realizados int, desvio int, pct_aderencia numeric)
language sql stable security definer set search_path = public as $$
  with intervals as (
    select step, days from (values (1::smallint,1),(2::smallint,3),(3::smallint,7),(4::smallint,15),(5::smallint,21),(6::smallint,30)) v(step,days)
  ),
  t as (
    select pt.prospect_id, pt.enviado_em from public.prospect_touchpoints pt
    join public.prospects p on p.id = pt.prospect_id
    where p.user_id = auth.uid() and pt.resultado <> 'tentativa' and pt.tipo <> 'nota'
  ),
  t_ord as (
    select prospect_id, enviado_em,
      row_number() over (partition by prospect_id order by enviado_em)::smallint as rn,
      lead(enviado_em) over (partition by prospect_id order by enviado_em) as next_envio
    from t
  ),
  prev_hist as (
    select (t_ord.enviado_em + (i.days || ' days')::interval)::date as previsto_para
    from t_ord join intervals i on i.step = t_ord.rn where t_ord.next_envio is not null
  ),
  prev_fut as (
    select next_contact_at::date as previsto_para from public.prospects
    where user_id = auth.uid() and cadence_status = 'ativo' and next_contact_at is not null and next_contact_at::date >= current_date
  ),
  prev_agg as (
    select previsto_para as dia, count(*)::int as previstos from (
      select previsto_para from prev_hist union all select previsto_para from prev_fut
    ) u group by previsto_para
  ),
  real_agg as (select enviado_em::date as dia, count(*)::int as realizados from t group by enviado_em::date),
  dias as (select (current_date - _days + g)::date as dia from generate_series(0, _days * 2) g)
  select d.dia,
    coalesce(p.previstos, 0), coalesce(r.realizados, 0),
    coalesce(r.realizados, 0) - coalesce(p.previstos, 0),
    case when coalesce(p.previstos, 0) = 0 then null else round(100.0 * coalesce(r.realizados, 0) / p.previstos, 1) end
  from dias d left join prev_agg p on p.dia = d.dia left join real_agg r on r.dia = d.dia order by d.dia;
$$;
grant execute on function public.cadencia_followup_comparativo(int) to authenticated;

-- Contratos RPCs
create or replace function public.criar_contrato_from_proposta(p_proposal_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_user uuid; v_implantacao numeric; v_mensal numeric; v_seq int; v_numero text;
begin
  select id into v_id from public.contratos where proposal_id = p_proposal_id;
  if v_id is not null then return v_id; end if;
  select user_id, valor_implantacao, valor_mensal into v_user, v_implantacao, v_mensal
    from public.proposals where id = p_proposal_id;
  if v_user is null then raise exception 'Proposta não encontrada'; end if;
  if v_user <> auth.uid() then raise exception 'Acesso negado'; end if;
  select coalesce(max(substring(numero from '(\d+)$')::int), 0) + 1 into v_seq
    from public.contratos where numero like 'CTR-' || to_char(now(),'YYYY') || '-%';
  v_numero := 'CTR-' || to_char(now(),'YYYY') || '-' || lpad(v_seq::text, 4, '0');
  insert into public.contratos(user_id, proposal_id, numero, status, valor_implantacao, valor_mensal)
  values (v_user, p_proposal_id, v_numero, 'aguardando_formalizacao', coalesce(v_implantacao, 0), coalesce(v_mensal, 0))
  returning id into v_id;
  insert into public.contrato_eventos(contrato_id, tipo, actor_type, actor_id)
  values (v_id, 'evt_contrato_criado', 'system', auth.uid());
  return v_id;
end $$;
grant execute on function public.criar_contrato_from_proposta(uuid) to authenticated;

create or replace function public.finalizar_contrato(p_contrato_id uuid, p_assinatura_tipo text, p_assinatura_payload text, p_assinatura_nome text, p_ip text default null, p_ua text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_proposal uuid;
begin
  select user_id, proposal_id into v_user, v_proposal from public.contratos where id = p_contrato_id;
  if v_user is null then raise exception 'Contrato não encontrado'; end if;
  if v_user <> auth.uid() then raise exception 'Acesso negado'; end if;
  update public.contratos set status = 'assinado',
    assinatura_tipo = p_assinatura_tipo::public.contrato_assinatura_tipo,
    assinatura_payload = p_assinatura_payload, assinatura_nome = p_assinatura_nome,
    assinatura_ip = p_ip, assinatura_user_agent = p_ua,
    assinado_em = now(), formalizado_em = now()
  where id = p_contrato_id;
  update public.proposals set contract_status = 'assinado'::public.contract_status,
    status = case when status = 'aprovada' then 'convertida'::public.proposal_status else status end,
    converted_at = coalesce(converted_at, now())
  where id = v_proposal;
  insert into public.contrato_eventos(contrato_id, tipo, payload, actor_id, ip)
  values (p_contrato_id, 'evt_contrato_assinado',
    jsonb_build_object('tipo', p_assinatura_tipo, 'nome', p_assinatura_nome), auth.uid(), p_ip);
end $$;
grant execute on function public.finalizar_contrato(uuid, text, text, text, text, text) to authenticated;

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, description text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
grant select, insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;
alter table public.teams enable row level security;
drop policy if exists teams_org_read on public.teams;
create policy teams_org_read on public.teams for select to authenticated using (organization_id = public.current_org_id());
drop policy if exists teams_org_write on public.teams;
create policy teams_org_write on public.teams for all to authenticated
  using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
create index if not exists idx_teams_org on public.teams(organization_id);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text,
  team_role text not null default 'member' check (team_role in ('lider','supervisor','member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
alter table public.team_members enable row level security;
drop policy if exists tmemb_read on public.team_members;
create policy tmemb_read on public.team_members for select to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.organization_id = public.current_org_id()));
drop policy if exists tmemb_write on public.team_members;
create policy tmemb_write on public.team_members for all to authenticated
  using (exists (select 1 from public.teams t where t.id = team_id and t.organization_id = public.current_org_id()))
  with check (exists (select 1 from public.teams t where t.id = team_id and t.organization_id = public.current_org_id()));
create index if not exists idx_team_members_user on public.team_members(user_id);

-- View compat op_contracts (alias sobre contratos)
create or replace view public.op_contracts with (security_invoker = true) as
select c.id, c.numero as empresa, null::text as source, null::text as origem,
  c.valor_mensal as monthly_value,
  (c.valor_implantacao + c.valor_mensal * coalesce(c.prazo_minimo_meses, 12)) as contract_value,
  c.assinado_em as signed_at, c.status::text as status, c.user_id
from public.contratos c;
grant select on public.op_contracts to authenticated;

notify pgrst, 'reload schema';