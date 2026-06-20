-- ============================================================
-- INFINDA — Módulo PROPOSTAS (núcleo comercial/operacional)
-- Arquitetura preparada para:
--   CRM, Briefing, Kickoff, Demandas, Projetos, Financeiro,
--   Contratos, Assinatura, Portal Cliente, Comissão, BI, IA.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- ---------- Enums ----------
do $$ begin
  create type public.proposal_status as enum (
    'rascunho','enviada','visualizada','ajustes_solicitados',
    'aprovada','rejeitada','expirada','convertida'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum (
    'nao_gerado','gerado','enviado','assinado','cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.proposal_send_channel as enum ('link','whatsapp','email');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.proposal_decision as enum ('aprovada','ajustes','rejeitada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.commission_role as enum ('vendedor','gestor','indicador');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.commission_base as enum ('implantacao','mensal','total');
exception when duplicate_object then null; end $$;

-- ---------- Helper: token público URL-safe ----------
create or replace function public.gen_proposal_token()
returns text language sql volatile as $$
  select translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');
$$;

-- ============================================================
-- 1) PROPOSALS
-- ============================================================
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gestor_id uuid references auth.users(id) on delete set null,

  deal_id uuid references public.deals(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.prospects(id) on delete set null,

  numero text unique,
  titulo text not null default 'Proposta Comercial',
  status public.proposal_status not null default 'rascunho',
  current_version_id uuid,

  valor_implantacao numeric(12,2) not null default 0,
  valor_mensal numeric(12,2) not null default 0,
  valor_avulso numeric(12,2) not null default 0,
  desconto_pct numeric(5,2) not null default 0,
  desconto_motivo text,

  validade_dias int not null default 7,
  valid_until timestamptz,

  token_publico text unique not null default public.gen_proposal_token(),
  pdf_url text,
  pdf_generated_at timestamptz,

  contract_id uuid,
  contract_status public.contract_status not null default 'nao_gerado',

  motivo_perda text,
  motivo_aprovacao text,
  concorrente text,

  sent_at timestamptz,
  first_viewed_at timestamptz,
  decided_at timestamptz,
  expired_at timestamptz,
  converted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists proposals_user_idx on public.proposals(user_id);
create index if not exists proposals_deal_idx on public.proposals(deal_id);
create index if not exists proposals_client_idx on public.proposals(client_id);
create index if not exists proposals_lead_idx on public.proposals(lead_id);
create index if not exists proposals_status_idx on public.proposals(user_id, status);
create index if not exists proposals_token_idx on public.proposals(token_publico);

grant select, insert, update, delete on public.proposals to authenticated;
grant all on public.proposals to service_role;

alter table public.proposals enable row level security;
drop policy if exists "proposals owner all" on public.proposals;
create policy "proposals owner all" on public.proposals
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Numeração PROP-YYYY-NNNN por usuário/ano
create or replace function public.proposals_set_numero()
returns trigger language plpgsql as $$
declare
  v_year text := to_char(now(),'YYYY');
  v_count int;
begin
  if new.numero is null or new.numero = '' then
    select count(*) + 1 into v_count
      from public.proposals
     where user_id = new.user_id
       and to_char(created_at,'YYYY') = v_year;
    new.numero := 'PROP-' || v_year || '-' || lpad(v_count::text, 4, '0');
  end if;
  if new.valid_until is null and new.validade_dias is not null then
    new.valid_until := now() + (new.validade_dias || ' days')::interval;
  end if;
  return new;
end $$;

drop trigger if exists trg_proposals_set_numero on public.proposals;
create trigger trg_proposals_set_numero
  before insert on public.proposals
  for each row execute function public.proposals_set_numero();

create or replace function public.proposals_touch_updated()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_proposals_touch on public.proposals;
create trigger trg_proposals_touch
  before update on public.proposals
  for each row execute function public.proposals_touch_updated();

-- ============================================================
-- 2) PROPOSAL VERSIONS (histórico imutável)
-- ============================================================
create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_number int not null,
  conteudo_json jsonb not null default '{}'::jsonb,
  valor_implantacao numeric(12,2) not null default 0,
  valor_mensal numeric(12,2) not null default 0,
  valor_avulso numeric(12,2) not null default 0,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (proposal_id, version_number)
);

create index if not exists proposal_versions_proposal_idx
  on public.proposal_versions(proposal_id, version_number desc);

grant select, insert on public.proposal_versions to authenticated;
grant all on public.proposal_versions to service_role;

alter table public.proposal_versions enable row level security;
drop policy if exists "proposal_versions owner" on public.proposal_versions;
create policy "proposal_versions owner" on public.proposal_versions
  for all to authenticated
  using (exists (
    select 1 from public.proposals p
    where p.id = proposal_versions.proposal_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.proposals p
    where p.id = proposal_versions.proposal_id and p.user_id = auth.uid()
  ));

-- ============================================================
-- 3) PROPOSAL ITEMS (snapshot do catálogo)
-- ============================================================
create table if not exists public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,

  nome text not null,
  descricao text,
  categoria text,
  area text,
  cobranca text not null default 'implantacao'
    check (cobranca in ('implantacao','mensal','avulso')),

  quantidade numeric(10,2) not null default 1,
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(12,2) not null default 0,
  prazo_dias int,
  entregaveis text[] not null default '{}',

  -- Molde preparado p/ futuro módulo de Demandas/Projetos
  future_demand_template jsonb not null default '{}'::jsonb,

  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists proposal_items_proposal_idx on public.proposal_items(proposal_id);

grant select, insert, update, delete on public.proposal_items to authenticated;
grant all on public.proposal_items to service_role;

alter table public.proposal_items enable row level security;
drop policy if exists "proposal_items owner" on public.proposal_items;
create policy "proposal_items owner" on public.proposal_items
  for all to authenticated
  using (exists (
    select 1 from public.proposals p
    where p.id = proposal_items.proposal_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.proposals p
    where p.id = proposal_items.proposal_id and p.user_id = auth.uid()
  ));

-- Recalcula totais agregados em proposals
create or replace function public.proposals_recalc_totais(p_proposal_id uuid)
returns void language plpgsql as $$
declare
  v_imp numeric(12,2) := 0;
  v_men numeric(12,2) := 0;
  v_avu numeric(12,2) := 0;
begin
  select
    coalesce(sum(case when cobranca='implantacao' then valor_total else 0 end),0),
    coalesce(sum(case when cobranca='mensal'      then valor_total else 0 end),0),
    coalesce(sum(case when cobranca='avulso'      then valor_total else 0 end),0)
    into v_imp, v_men, v_avu
    from public.proposal_items where proposal_id = p_proposal_id;
  update public.proposals
     set valor_implantacao = v_imp,
         valor_mensal      = v_men,
         valor_avulso      = v_avu,
         updated_at        = now()
   where id = p_proposal_id;
end $$;

create or replace function public.proposal_items_recalc_trigger()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.proposals_recalc_totais(old.proposal_id);
    return old;
  else
    -- garante valor_total = quantidade * valor_unitario quando vazio
    if new.valor_total = 0 and new.valor_unitario > 0 then
      new.valor_total := new.quantidade * new.valor_unitario;
    end if;
    perform public.proposals_recalc_totais(new.proposal_id);
    return new;
  end if;
end $$;

drop trigger if exists trg_proposal_items_recalc on public.proposal_items;
create trigger trg_proposal_items_recalc
  after insert or update or delete on public.proposal_items
  for each row execute function public.proposal_items_recalc_trigger();

-- ============================================================
-- 4) PROPOSAL VIEWS, APPROVALS, SENDS, EVENTS
-- ============================================================
create table if not exists public.proposal_views (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_id uuid references public.proposal_versions(id) on delete set null,
  viewed_at timestamptz not null default now(),
  ip inet,
  user_agent text,
  referrer text
);
create index if not exists proposal_views_proposal_idx on public.proposal_views(proposal_id, viewed_at desc);
grant select, insert on public.proposal_views to authenticated;
grant all on public.proposal_views to service_role;
alter table public.proposal_views enable row level security;
drop policy if exists "proposal_views owner read" on public.proposal_views;
create policy "proposal_views owner read" on public.proposal_views
  for select to authenticated using (exists (
    select 1 from public.proposals p
    where p.id = proposal_views.proposal_id and p.user_id = auth.uid()
  ));

create table if not exists public.proposal_approvals (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_id uuid references public.proposal_versions(id) on delete set null,
  decisao public.proposal_decision not null,
  nome text,
  cargo text,
  documento text,
  mensagem text,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists proposal_approvals_proposal_idx on public.proposal_approvals(proposal_id, created_at desc);
grant select, insert on public.proposal_approvals to authenticated;
grant all on public.proposal_approvals to service_role;
alter table public.proposal_approvals enable row level security;
drop policy if exists "proposal_approvals owner read" on public.proposal_approvals;
create policy "proposal_approvals owner read" on public.proposal_approvals
  for select to authenticated using (exists (
    select 1 from public.proposals p
    where p.id = proposal_approvals.proposal_id and p.user_id = auth.uid()
  ));

create table if not exists public.proposal_sends (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  canal public.proposal_send_channel not null,
  destino text,
  mensagem text,
  enviado_por uuid references auth.users(id) on delete set null,
  enviado_at timestamptz not null default now(),
  status text not null default 'registrado',
  meta jsonb not null default '{}'::jsonb
);
create index if not exists proposal_sends_proposal_idx on public.proposal_sends(proposal_id, enviado_at desc);
grant select, insert, update on public.proposal_sends to authenticated;
grant all on public.proposal_sends to service_role;
alter table public.proposal_sends enable row level security;
drop policy if exists "proposal_sends owner" on public.proposal_sends;
create policy "proposal_sends owner" on public.proposal_sends
  for all to authenticated
  using (exists (
    select 1 from public.proposals p
    where p.id = proposal_sends.proposal_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.proposals p
    where p.id = proposal_sends.proposal_id and p.user_id = auth.uid()
  ));

-- Timeline / event bus (consumível por automações/WhatsApp/Email/IA/webhook)
create table if not exists public.proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  tipo text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('user','client','system')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists proposal_events_proposal_idx on public.proposal_events(proposal_id, created_at desc);
create index if not exists proposal_events_tipo_idx on public.proposal_events(tipo, created_at desc);
grant select, insert on public.proposal_events to authenticated;
grant all on public.proposal_events to service_role;
alter table public.proposal_events enable row level security;
drop policy if exists "proposal_events owner read" on public.proposal_events;
create policy "proposal_events owner read" on public.proposal_events
  for select to authenticated using (exists (
    select 1 from public.proposals p
    where p.id = proposal_events.proposal_id and p.user_id = auth.uid()
  ));

-- ============================================================
-- 5) PROPOSAL COMMISSIONS (preparado p/ comissionamento)
-- ============================================================
create table if not exists public.proposal_commissions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  papel public.commission_role not null default 'vendedor',
  percentual numeric(5,2) not null default 0,
  base_calculo public.commission_base not null default 'implantacao',
  valor_calculado numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.proposal_commissions to authenticated;
grant all on public.proposal_commissions to service_role;
alter table public.proposal_commissions enable row level security;
drop policy if exists "proposal_commissions owner" on public.proposal_commissions;
create policy "proposal_commissions owner" on public.proposal_commissions
  for all to authenticated
  using (exists (
    select 1 from public.proposals p
    where p.id = proposal_commissions.proposal_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.proposals p
    where p.id = proposal_commissions.proposal_id and p.user_id = auth.uid()
  ));

-- ============================================================
-- 6) CONTRACTS (estrutura preparada — Clicksign/D4Sign/DocuSign)
-- ============================================================
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  provider text not null default 'manual',
  status public.contract_status not null default 'nao_gerado',
  pdf_url text,
  external_id text,
  signed_at timestamptz,
  valid_from date,
  valid_until date,
  renovacao text not null default 'manual' check (renovacao in ('manual','automatica')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contracts_user_idx on public.contracts(user_id);
create index if not exists contracts_proposal_idx on public.contracts(proposal_id);
grant select, insert, update, delete on public.contracts to authenticated;
grant all on public.contracts to service_role;
alter table public.contracts enable row level security;
drop policy if exists "contracts owner" on public.contracts;
create policy "contracts owner" on public.contracts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  signatario_nome text,
  email text,
  documento text,
  signed_at timestamptz,
  ip inet,
  provider_event_id text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contract_signatures to authenticated;
grant all on public.contract_signatures to service_role;
alter table public.contract_signatures enable row level security;
drop policy if exists "contract_signatures owner" on public.contract_signatures;
create policy "contract_signatures owner" on public.contract_signatures
  for all to authenticated
  using (exists (
    select 1 from public.contracts c
    where c.id = contract_signatures.contract_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.contracts c
    where c.id = contract_signatures.contract_id and c.user_id = auth.uid()
  ));

-- ============================================================
-- 7) CLIENT FINANCIALS (MRR/ARR/LTV — preparado p/ Financeiro/BI)
-- ============================================================
create table if not exists public.client_financials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mrr numeric(12,2) not null default 0,
  arr numeric(12,2) not null default 0,
  implantacao_acumulada numeric(12,2) not null default 0,
  ltv_estimado numeric(12,2) not null default 0,
  ultima_atualizacao timestamptz not null default now()
);
grant select, insert, update on public.client_financials to authenticated;
grant all on public.client_financials to service_role;
alter table public.client_financials enable row level security;
drop policy if exists "client_financials owner" on public.client_financials;
create policy "client_financials owner" on public.client_financials
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 8) ACTIVITY LOGS (governança/auditoria)
-- ============================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  before jsonb,
  after  jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_entity_idx on public.activity_logs(entity_type, entity_id, created_at desc);
grant select, insert on public.activity_logs to authenticated;
grant all on public.activity_logs to service_role;
alter table public.activity_logs enable row level security;
drop policy if exists "activity_logs read" on public.activity_logs;
create policy "activity_logs read" on public.activity_logs
  for select to authenticated using (true);

create or replace function public.proposals_audit_trigger()
returns trigger language plpgsql security definer as $$
begin
  insert into public.activity_logs(entity_type, entity_id, action, actor_id, before, after)
  values ('proposal', coalesce(new.id, old.id), tg_op, auth.uid(),
          case when tg_op<>'INSERT' then to_jsonb(old) end,
          case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_proposals_audit on public.proposals;
create trigger trg_proposals_audit
  after insert or update or delete on public.proposals
  for each row execute function public.proposals_audit_trigger();

-- ============================================================
-- 9) RPCs PRINCIPAIS
-- ============================================================

-- 9.1 Criar proposta a partir de um deal OU prospect.
create or replace function public.create_proposal_from_source(
  p_deal_id uuid default null,
  p_prospect_id uuid default null,
  p_titulo text default 'Proposta Comercial'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_deal public.deals%rowtype;
  v_client uuid;
  v_prop uuid;
  v_version uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  if p_deal_id is not null then
    select * into v_deal from public.deals where id = p_deal_id and user_id = v_user;
    if not found then raise exception 'deal não encontrado'; end if;
    v_client := v_deal.client_id;
  end if;

  insert into public.proposals(user_id, deal_id, client_id, lead_id, titulo)
  values (v_user, p_deal_id, v_client, p_prospect_id, coalesce(p_titulo,'Proposta Comercial'))
  returning id into v_prop;

  insert into public.proposal_versions(proposal_id, version_number, conteudo_json, created_by)
  values (v_prop, 1, '{}'::jsonb, v_user)
  returning id into v_version;

  update public.proposals set current_version_id = v_version where id = v_prop;

  insert into public.proposal_events(proposal_id, tipo, actor_id, actor_type, payload)
  values (v_prop, 'proposal_created', v_user, 'user',
          jsonb_build_object('deal_id', p_deal_id, 'prospect_id', p_prospect_id));

  return v_prop;
end $$;
grant execute on function public.create_proposal_from_source(uuid, uuid, text) to authenticated;

-- 9.2 Criar nova versão
create or replace function public.create_proposal_version(
  p_proposal_id uuid,
  p_conteudo jsonb,
  p_observacoes text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_next int;
  v_id uuid;
  v_p public.proposals%rowtype;
begin
  select * into v_p from public.proposals where id = p_proposal_id and user_id = v_user;
  if not found then raise exception 'proposta não encontrada'; end if;

  select coalesce(max(version_number),0)+1 into v_next
    from public.proposal_versions where proposal_id = p_proposal_id;

  insert into public.proposal_versions(
    proposal_id, version_number, conteudo_json,
    valor_implantacao, valor_mensal, valor_avulso,
    observacoes, created_by
  ) values (
    p_proposal_id, v_next, coalesce(p_conteudo,'{}'::jsonb),
    v_p.valor_implantacao, v_p.valor_mensal, v_p.valor_avulso,
    p_observacoes, v_user
  ) returning id into v_id;

  update public.proposals set current_version_id = v_id, updated_at = now()
    where id = p_proposal_id;

  insert into public.proposal_events(proposal_id, tipo, actor_id, actor_type, payload)
  values (p_proposal_id, 'version_created', v_user, 'user',
          jsonb_build_object('version_number', v_next));

  return v_id;
end $$;
grant execute on function public.create_proposal_version(uuid, jsonb, text) to authenticated;

-- 9.3 Registrar envio (link/whatsapp/email)
create or replace function public.register_proposal_send(
  p_proposal_id uuid,
  p_canal text,
  p_destino text default null,
  p_mensagem text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if not exists(select 1 from public.proposals where id = p_proposal_id and user_id = v_user) then
    raise exception 'proposta não encontrada';
  end if;
  insert into public.proposal_sends(proposal_id, canal, destino, mensagem, enviado_por)
  values (p_proposal_id, p_canal::public.proposal_send_channel, p_destino, p_mensagem, v_user);

  update public.proposals
     set status = case when status = 'rascunho' then 'enviada'::public.proposal_status else status end,
         sent_at = coalesce(sent_at, now())
   where id = p_proposal_id;

  insert into public.proposal_events(proposal_id, tipo, actor_id, actor_type, payload)
  values (p_proposal_id, 'proposal_sent', v_user, 'user',
          jsonb_build_object('canal', p_canal, 'destino', p_destino));
end $$;
grant execute on function public.register_proposal_send(uuid, text, text, text) to authenticated;

-- 9.4 RPC pública — leitura por token (sem login)
drop function if exists public.get_proposal_by_token(text);
create or replace function public.get_proposal_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'numero', p.numero,
    'titulo', p.titulo,
    'status', p.status,
    'valor_implantacao', p.valor_implantacao,
    'valor_mensal', p.valor_mensal,
    'valor_avulso', p.valor_avulso,
    'validade_dias', p.validade_dias,
    'valid_until', p.valid_until,
    'sent_at', p.sent_at,
    'first_viewed_at', p.first_viewed_at,
    'current_version_id', p.current_version_id,
    'cliente', jsonb_build_object(
      'company', c.company,
      'contact_name', c.contact_name,
      'segment', c.segment,
      'city', c.city,
      'state', c.state
    ),
    'lead', jsonb_build_object(
      'company', pr.company,
      'owner', pr.owner,
      'segment', pr.segment
    ),
    'versao', jsonb_build_object(
      'version_number', v.version_number,
      'conteudo_json', v.conteudo_json
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome, 'descricao', i.descricao,
        'categoria', i.categoria, 'cobranca', i.cobranca,
        'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario,
        'valor_total', i.valor_total, 'prazo_dias', i.prazo_dias,
        'entregaveis', i.entregaveis, 'ordem', i.ordem
      ) order by i.ordem)
      from public.proposal_items i where i.proposal_id = p.id
    ), '[]'::jsonb)
  )
  into v
  from public.proposals p
  left join public.clients c on c.id = p.client_id
  left join public.prospects pr on pr.id = p.lead_id
  left join public.proposal_versions v on v.id = p.current_version_id
  where p.token_publico = p_token
  limit 1;
  return v;
end $$;
grant execute on function public.get_proposal_by_token(text) to anon, authenticated;

-- 9.5 RPC pública — registrar visualização
create or replace function public.register_proposal_view(
  p_token text, p_ua text default null, p_referrer text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_prop uuid; v_ver uuid;
begin
  select id, current_version_id into v_prop, v_ver
    from public.proposals where token_publico = p_token;
  if v_prop is null then return; end if;

  insert into public.proposal_views(proposal_id, version_id, user_agent, referrer)
  values (v_prop, v_ver, p_ua, p_referrer);

  update public.proposals
     set first_viewed_at = coalesce(first_viewed_at, now()),
         status = case
           when status in ('enviada') then 'visualizada'::public.proposal_status
           else status end
   where id = v_prop;

  insert into public.proposal_events(proposal_id, tipo, actor_type, payload)
  values (v_prop, 'proposal_viewed', 'client', jsonb_build_object('ua', p_ua));
end $$;
grant execute on function public.register_proposal_view(text, text, text) to anon, authenticated;

-- 9.6 RPC pública — submeter decisão e disparar pipeline
create or replace function public.submit_proposal_decision(
  p_token text,
  p_decisao text,
  p_nome text,
  p_cargo text default null,
  p_documento text default null,
  p_mensagem text default null,
  p_ua text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prop public.proposals%rowtype;
  v_briefing_id uuid;
  v_briefing_token text;
  v_new_status public.proposal_status;
begin
  select * into v_prop from public.proposals where token_publico = p_token;
  if not found then raise exception 'proposta não encontrada'; end if;

  v_new_status := case p_decisao
    when 'aprovada' then 'aprovada'::public.proposal_status
    when 'ajustes'  then 'ajustes_solicitados'::public.proposal_status
    when 'rejeitada' then 'rejeitada'::public.proposal_status
    else null end;
  if v_new_status is null then raise exception 'decisão inválida'; end if;

  insert into public.proposal_approvals(
    proposal_id, version_id, decisao, nome, cargo, documento, mensagem, user_agent
  ) values (
    v_prop.id, v_prop.current_version_id, p_decisao::public.proposal_decision,
    p_nome, p_cargo, p_documento, p_mensagem, p_ua
  );

  update public.proposals
     set status = v_new_status,
         decided_at = now(),
         motivo_aprovacao = case when p_decisao='aprovada' then coalesce(motivo_aprovacao, p_mensagem) else motivo_aprovacao end,
         motivo_perda     = case when p_decisao='rejeitada' then coalesce(motivo_perda, p_mensagem) else motivo_perda end
   where id = v_prop.id;

  insert into public.proposal_events(proposal_id, tipo, actor_type, payload)
  values (v_prop.id,
          case p_decisao when 'aprovada' then 'proposal_approved'
                         when 'ajustes'  then 'adjustments_requested'
                         else 'proposal_rejected' end,
          'client',
          jsonb_build_object('nome', p_nome, 'cargo', p_cargo, 'documento', p_documento));

  -- Pipeline: aprovação → cria Briefing Comercial automaticamente
  if p_decisao = 'aprovada' then
    insert into public.briefings(user_id, tipo, status, lead_id, cliente_nome, empresa, telefone, email, servico, respostas_json, token_publico, proposal_id)
    select v_prop.user_id,
           'briefing_comercial',
           'pendente',
           v_prop.lead_id,
           coalesce(c.contact_name, p_nome),
           coalesce(c.company, pr.company, v_prop.titulo),
           coalesce(c.phone, pr.phone),
           coalesce(c.email, pr.email),
           'gestao_trafego',
           jsonb_build_object('proposal_id', v_prop.id, 'proposal_numero', v_prop.numero),
           translate(encode(gen_random_bytes(18),'base64'),'+/=','-_'),
           v_prop.id
      from public.proposals p
      left join public.clients c on c.id = p.client_id
      left join public.prospects pr on pr.id = p.lead_id
      where p.id = v_prop.id
    returning id, token_publico into v_briefing_id, v_briefing_token;

    insert into public.proposal_events(proposal_id, tipo, actor_type, payload)
    values (v_prop.id, 'briefing_created', 'system',
            jsonb_build_object('briefing_id', v_briefing_id, 'token', v_briefing_token));
  end if;

  return jsonb_build_object(
    'status', v_new_status,
    'briefing_id', v_briefing_id,
    'briefing_token', v_briefing_token
  );
exception when others then
  -- Se briefing falhar (ex.: schema antigo), ainda retornamos a decisão.
  return jsonb_build_object(
    'status', v_new_status,
    'error', sqlerrm
  );
end $$;
grant execute on function public.submit_proposal_decision(text, text, text, text, text, text, text) to anon, authenticated;

-- 9.7 Expiração de propostas (rodar via pg_cron hourly)
create or replace function public.expire_proposals()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with upd as (
    update public.proposals
       set status = 'expirada'::public.proposal_status,
           expired_at = now()
     where valid_until is not null
       and valid_until < now()
       and status in ('rascunho','enviada','visualizada','ajustes_solicitados')
    returning id
  )
  insert into public.proposal_events(proposal_id, tipo, actor_type)
  select id, 'proposal_expired', 'system' from upd;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function public.expire_proposals() to authenticated;

-- ============================================================
-- 10) Atualizações auxiliares
-- ============================================================

-- briefings: vínculo com proposta (não obrigatório; aditivo)
alter table public.briefings add column if not exists proposal_id uuid;
alter table public.briefings add column if not exists proposal_version_id uuid;

-- deals: atalho da proposta atual
alter table public.deals add column if not exists current_proposal_id uuid;

-- Reload PostgREST
notify pgrst, 'reload schema';