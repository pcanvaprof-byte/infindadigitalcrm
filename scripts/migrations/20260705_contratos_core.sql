-- ============================================================
-- INFINDA — Módulo CONTRATOS (Formalização Contratual)
-- Wizard 8 etapas + histórico + documentos
-- Aplicar via SQL Editor do Supabase.
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin
  create type public.contrato_status as enum (
    'aguardando_formalizacao','em_preenchimento','aguardando_assinatura',
    'assinado','pendente_financeiro','ativo','cancelado','encerrado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contrato_tipo_pessoa as enum ('pf','pj');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contrato_metodo_pgto as enum ('pix','boleto','cartao','transferencia');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contrato_assinatura_tipo as enum ('desenhada','digitada','email');
exception when duplicate_object then null; end $$;

-- ============================================================
-- contratos: tabela principal
-- ============================================================
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null unique references public.proposals(id) on delete cascade,
  numero text unique not null,
  status public.contrato_status not null default 'aguardando_formalizacao',

  -- valores espelhados da proposta
  valor_implantacao numeric(12,2) not null default 0,
  valor_mensal numeric(12,2) not null default 0,
  valor_investimento_midia numeric(12,2) default 0,
  prazo_minimo_meses int not null default 3,
  prazo_implantacao_dias int default 30,

  -- contratante
  tipo_pessoa public.contrato_tipo_pessoa,
  dados_pessoa jsonb not null default '{}'::jsonb,

  -- financeiro
  metodo_pagamento public.contrato_metodo_pgto,
  dia_vencimento int,
  parcelamento_implantacao int default 1,
  dados_bancarios jsonb not null default '{}'::jsonb,
  observacoes_financeiras text,

  -- escopo (array de itens com entregáveis enriquecidos)
  escopo jsonb not null default '[]'::jsonb,

  -- aceites
  aceites jsonb not null default '{}'::jsonb,

  -- assinatura
  assinatura_tipo public.contrato_assinatura_tipo,
  assinatura_payload text,
  assinatura_nome text,
  assinatura_ip text,
  assinatura_user_agent text,
  assinado_em timestamptz,

  -- pdf
  pdf_url text,
  pdf_gerado_em timestamptz,

  -- timestamps de ciclo
  formalizado_em timestamptz,
  cancelado_em timestamptz,
  cancelado_motivo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contratos_user_idx on public.contratos(user_id, updated_at desc);
create index if not exists contratos_status_idx on public.contratos(status);
create index if not exists contratos_proposal_idx on public.contratos(proposal_id);

grant select, insert, update on public.contratos to authenticated;
grant all on public.contratos to service_role;
alter table public.contratos enable row level security;

drop policy if exists "contratos owner all" on public.contratos;
create policy "contratos owner all" on public.contratos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- trigger updated_at
create or replace function public.tg_contratos_updated() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists tg_contratos_updated on public.contratos;
create trigger tg_contratos_updated before update on public.contratos
  for each row execute function public.tg_contratos_updated();

-- ============================================================
-- contrato_documentos
-- ============================================================
create table if not exists public.contrato_documentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  tipo text not null,
  nome text not null,
  storage_path text not null,
  mime text,
  tamanho int,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cd_contrato_idx on public.contrato_documentos(contrato_id);

grant select, insert, delete on public.contrato_documentos to authenticated;
grant all on public.contrato_documentos to service_role;
alter table public.contrato_documentos enable row level security;

drop policy if exists "cd owner" on public.contrato_documentos;
create policy "cd owner" on public.contrato_documentos
  for all to authenticated
  using (exists (select 1 from public.contratos c where c.id = contrato_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.contratos c where c.id = contrato_id and c.user_id = auth.uid()));

-- ============================================================
-- contrato_eventos (histórico / timeline)
-- ============================================================
create table if not exists public.contrato_eventos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  tipo text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user',
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists ce_contrato_idx on public.contrato_eventos(contrato_id, created_at desc);

grant select, insert on public.contrato_eventos to authenticated;
grant all on public.contrato_eventos to service_role;
alter table public.contrato_eventos enable row level security;

drop policy if exists "ce owner" on public.contrato_eventos;
create policy "ce owner" on public.contrato_eventos
  for all to authenticated
  using (exists (select 1 from public.contratos c where c.id = contrato_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.contratos c where c.id = contrato_id and c.user_id = auth.uid()));

-- ============================================================
-- RPC: criar contrato a partir de proposta aprovada
-- Idempotente — se já existe contrato para a proposta, retorna o existente.
-- ============================================================
create or replace function public.criar_contrato_from_proposta(p_proposal_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_user uuid;
  v_implantacao numeric;
  v_mensal numeric;
  v_seq int;
  v_numero text;
begin
  select id into v_id from public.contratos where proposal_id = p_proposal_id;
  if v_id is not null then return v_id; end if;

  select user_id, valor_implantacao, valor_mensal
    into v_user, v_implantacao, v_mensal
    from public.proposals where id = p_proposal_id;

  if v_user is null then raise exception 'Proposta não encontrada'; end if;
  if v_user <> auth.uid() then raise exception 'Acesso negado'; end if;

  select coalesce(max(substring(numero from '(\d+)$')::int), 0) + 1 into v_seq
    from public.contratos
   where numero like 'CTR-' || to_char(now(),'YYYY') || '-%';

  v_numero := 'CTR-' || to_char(now(),'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.contratos(
    user_id, proposal_id, numero, status,
    valor_implantacao, valor_mensal
  ) values (
    v_user, p_proposal_id, v_numero, 'aguardando_formalizacao',
    coalesce(v_implantacao, 0), coalesce(v_mensal, 0)
  ) returning id into v_id;

  insert into public.contrato_eventos(contrato_id, tipo, actor_type, actor_id)
  values (v_id, 'evt_contrato_criado', 'system', auth.uid());

  return v_id;
end $$;
grant execute on function public.criar_contrato_from_proposta(uuid) to authenticated;

-- ============================================================
-- RPC: finalizar contrato (assinatura → ativo)
-- ============================================================
create or replace function public.finalizar_contrato(
  p_contrato_id uuid,
  p_assinatura_tipo text,
  p_assinatura_payload text,
  p_assinatura_nome text,
  p_ip text default null,
  p_ua text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_proposal uuid;
begin
  select user_id, proposal_id into v_user, v_proposal
    from public.contratos where id = p_contrato_id;
  if v_user is null then raise exception 'Contrato não encontrado'; end if;
  if v_user <> auth.uid() then raise exception 'Acesso negado'; end if;

  update public.contratos set
    status = 'assinado',
    assinatura_tipo = p_assinatura_tipo::public.contrato_assinatura_tipo,
    assinatura_payload = p_assinatura_payload,
    assinatura_nome = p_assinatura_nome,
    assinatura_ip = p_ip,
    assinatura_user_agent = p_ua,
    assinado_em = now(),
    formalizado_em = now()
  where id = p_contrato_id;

  -- registra status convertida na proposta vinculada
  update public.proposals
     set contract_status = 'assinado'::public.contract_status,
         status = case when status = 'aprovada' then 'convertida'::public.proposal_status else status end,
         converted_at = coalesce(converted_at, now())
   where id = v_proposal;

  insert into public.contrato_eventos(contrato_id, tipo, payload, actor_id, ip)
  values (p_contrato_id, 'evt_contrato_assinado',
    jsonb_build_object('tipo', p_assinatura_tipo, 'nome', p_assinatura_nome),
    auth.uid(), p_ip);
end $$;
grant execute on function public.finalizar_contrato(uuid, text, text, text, text, text) to authenticated;

-- ============================================================
-- View de KPIs (dashboard de contratos)
-- ============================================================
create or replace view public.vw_contratos_kpis as
select
  user_id,
  count(*) filter (where status in ('ativo','assinado')) as ativos,
  count(*) filter (where status in ('aguardando_formalizacao','em_preenchimento','aguardando_assinatura')) as pendentes,
  count(*) filter (where status = 'assinado') as assinados,
  count(*) filter (where status = 'cancelado') as cancelados,
  coalesce(sum(valor_mensal) filter (where status in ('ativo','assinado')), 0) as mrr,
  coalesce(sum(valor_mensal) filter (where status in ('ativo','assinado')) * 12, 0) as arr,
  coalesce(avg(valor_implantacao + valor_mensal) filter (where status in ('ativo','assinado')), 0) as ticket_medio
from public.contratos
group by user_id;

grant select on public.vw_contratos_kpis to authenticated;

notify pgrst, 'reload schema';