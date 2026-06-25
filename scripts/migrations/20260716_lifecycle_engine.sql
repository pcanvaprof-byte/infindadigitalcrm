-- ============================================================================
-- Onda 1 — Client Lifecycle Engine
-- Estratégia: ADITIVA. Estende public.clients (não recria) e adiciona
-- camada de pipeline + eventos + transições + automações + backfill.
-- ============================================================================

-- 0) Enums ------------------------------------------------------------------
do $$ begin
  create type public.pipeline_stage as enum (
    'PROSPECCAO','CADENCIA','FECHADO','REUNIAO_INICIAL','PROPOSTA',
    'CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO',
    'CHURNED','PERDIDO'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_financial_status as enum (
    'pendente','confirmado','recorrente','inadimplente'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_lc_contract_status as enum (
    'nao_gerado','enviado','assinado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_onboarding_status as enum (
    'pendente','em_andamento','concluido'
  );
exception when duplicate_object then null; end $$;

-- 1) Estende public.clients com camada lifecycle ----------------------------
alter table public.clients
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists pipeline_stage public.pipeline_stage not null default 'PROSPECCAO',
  add column if not exists financial_status public.client_financial_status not null default 'pendente',
  add column if not exists lc_contract_status public.client_lc_contract_status not null default 'nao_gerado',
  add column if not exists onboarding_status public.client_onboarding_status not null default 'pendente',
  add column if not exists current_step text,
  add column if not exists next_action_date timestamptz,
  add column if not exists operations_locked boolean not null default true,
  add column if not exists created_from text,
  add column if not exists source_ref uuid,
  add column if not exists activated_at timestamptz,
  add column if not exists churned_at timestamptz,
  add column if not exists plano_code text,
  add column if not exists mensalidade numeric(12,2);

-- Backfill organization_id em clients existentes (uma única org por enquanto)
update public.clients c
   set organization_id = (
     select organization_id from public.user_active_org
      where user_id = c.user_id limit 1
   )
 where organization_id is null;

create index if not exists clients_pipeline_idx on public.clients(pipeline_stage);
create index if not exists clients_org_idx on public.clients(organization_id);
create index if not exists clients_next_action_idx on public.clients(next_action_date);
create index if not exists clients_source_idx on public.clients(created_from, source_ref);

-- 2) client_events ---------------------------------------------------------
create table if not exists public.client_events (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists client_events_client_idx on public.client_events(client_id, created_at desc);

grant select, insert on public.client_events to authenticated;
grant all on public.client_events to service_role;
alter table public.client_events enable row level security;
drop policy if exists client_events_rw on public.client_events;
create policy client_events_rw on public.client_events
  for all to authenticated
  using (
    exists (select 1 from public.clients c
              where c.id = client_events.client_id
                and (c.organization_id = public.current_org_id() or c.user_id = auth.uid()))
  )
  with check (
    exists (select 1 from public.clients c
              where c.id = client_events.client_id
                and (c.organization_id = public.current_org_id() or c.user_id = auth.uid()))
  );

-- 3) client_transitions ---------------------------------------------------
create table if not exists public.client_transitions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  from_stage public.pipeline_stage,
  to_stage public.pipeline_stage not null,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists client_transitions_client_idx on public.client_transitions(client_id, created_at desc);

grant select, insert on public.client_transitions to authenticated;
grant all on public.client_transitions to service_role;
alter table public.client_transitions enable row level security;
drop policy if exists client_transitions_rw on public.client_transitions;
create policy client_transitions_rw on public.client_transitions
  for all to authenticated
  using (
    exists (select 1 from public.clients c
              where c.id = client_transitions.client_id
                and (c.organization_id = public.current_org_id() or c.user_id = auth.uid()))
  )
  with check (
    exists (select 1 from public.clients c
              where c.id = client_transitions.client_id
                and (c.organization_id = public.current_org_id() or c.user_id = auth.uid()))
  );

-- 4) plan_templates -------------------------------------------------------
create table if not exists public.plan_templates (
  code text primary key,
  name text not null,
  mensalidade numeric(12,2) not null,
  campaigns jsonb not null default '[]'::jsonb,
  deliveries jsonb not null default '[]'::jsonb,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select on public.plan_templates to authenticated;
grant all on public.plan_templates to service_role;
alter table public.plan_templates enable row level security;
drop policy if exists plan_templates_read on public.plan_templates;
create policy plan_templates_read on public.plan_templates
  for select to authenticated
  using (organization_id is null or organization_id = public.current_org_id());

insert into public.plan_templates(code, name, mensalidade, campaigns, deliveries) values
 ('600','Gestão Tráfego Local',600,
    '["Reconhecimento","Mensagens WhatsApp"]'::jsonb,
    '["Configurar Pixel","Criar Campanha 1","Criar Campanha 2","Configurar Conversões","Reunião Inicial"]'::jsonb),
 ('1200','Gestão Tráfego Plus',1200,
    '["Reconhecimento","Mensagem","Remarketing","Oferta"]'::jsonb,
    '["Configurar Pixel","Criar 4 Campanhas","Configurar Conversões","Relatório Quinzenal","Reunião Inicial"]'::jsonb),
 ('2000','Funil Completo',2000,
    '["Topo","Meio","Fundo","Remarketing","Oferta","Reengajamento"]'::jsonb,
    '["Pixel + Eventos","6 Campanhas","Landing Page","Relatório Semanal","Reuniões Quinzenais"]'::jsonb)
on conflict (code) do nothing;

-- 5) commercial_plans (1:1 com clients em REUNIAO_INICIAL+) ---------------
create table if not exists public.commercial_plans (
  client_id uuid primary key references public.clients(id) on delete cascade,
  investimento_gestao numeric(12,2),
  investimento_trafego numeric(12,2),
  objetivo text,
  entregas jsonb not null default '[]'::jsonb,
  cronograma jsonb not null default '{}'::jsonb,
  validade_dias int not null default 7,
  plano_code text references public.plan_templates(code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.commercial_plans to authenticated;
grant all on public.commercial_plans to service_role;
alter table public.commercial_plans enable row level security;
drop policy if exists commercial_plans_rw on public.commercial_plans;
create policy commercial_plans_rw on public.commercial_plans
  for all to authenticated
  using (exists (select 1 from public.clients c
                  where c.id = commercial_plans.client_id
                    and (c.organization_id = public.current_org_id() or c.user_id = auth.uid())))
  with check (exists (select 1 from public.clients c
                  where c.id = commercial_plans.client_id
                    and (c.organization_id = public.current_org_id() or c.user_id = auth.uid())));

-- 6) Validação de transições ---------------------------------------------
create or replace function public.clients_can_advance(_client_id uuid, _target public.pipeline_stage)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare _cur public.pipeline_stage;
begin
  select pipeline_stage into _cur from public.clients where id = _client_id;
  if _cur is null then return false; end if;
  -- regressão permitida (volta de estágio); avanços livres na Onda 1.
  -- (Onda 2 endurece regras por matriz de transição.)
  return true;
end $$;
grant execute on function public.clients_can_advance(uuid, public.pipeline_stage) to authenticated;

-- 7) Trigger: loga transição + aplica automações mínimas ------------------
create or replace function public.clients_on_stage_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and NEW.pipeline_stage is distinct from OLD.pipeline_stage then
    -- Guard rail: trava/destrava operações conforme estágio
    if NEW.pipeline_stage = 'ATIVO' then
      NEW.operations_locked := false;
      NEW.activated_at := coalesce(NEW.activated_at, now());
    elsif NEW.pipeline_stage in ('CHURNED','PERDIDO') then
      NEW.operations_locked := true;
      NEW.churned_at := coalesce(NEW.churned_at, now());
    else
      NEW.operations_locked := true;
    end if;
  end if;
  return NEW;
end $$;

-- AFTER trigger: registra transições/eventos depois da linha existir
create or replace function public.clients_after_stage_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.client_transitions(client_id, from_stage, to_stage, actor_id, reason)
    values (NEW.id, null, NEW.pipeline_stage, auth.uid(), 'created');
  elsif TG_OP = 'UPDATE' and NEW.pipeline_stage is distinct from OLD.pipeline_stage then
    insert into public.client_transitions(client_id, from_stage, to_stage, actor_id)
    values (NEW.id, OLD.pipeline_stage, NEW.pipeline_stage, auth.uid());
    insert into public.client_events(client_id, organization_id, type, payload, actor_id)
    values (NEW.id, NEW.organization_id, 'STAGE_CHANGED',
            jsonb_build_object('from', OLD.pipeline_stage, 'to', NEW.pipeline_stage), auth.uid());
  end if;
  return null;
end $$;

drop trigger if exists trg_clients_stage_change on public.clients;
create trigger trg_clients_stage_change
  before update of pipeline_stage on public.clients
  for each row execute function public.clients_on_stage_change();

drop trigger if exists trg_clients_after_stage_change on public.clients;
create trigger trg_clients_after_stage_change
  after insert or update of pipeline_stage on public.clients
  for each row execute function public.clients_after_stage_change();

-- 8) View: timeline unificada --------------------------------------------
create or replace view public.client_timeline
with (security_invoker = on)
as
  select client_id, created_at, 'transition'::text as kind,
         jsonb_build_object('from', from_stage, 'to', to_stage, 'reason', reason) as data
    from public.client_transitions
  union all
  select client_id, created_at, 'event'::text as kind,
         jsonb_build_object('type', type, 'payload', payload) as data
    from public.client_events;

grant select on public.client_timeline to authenticated;

-- 9) BACKFILL — popula clients a partir do que já existe ------------------
do $$
declare
  v_now timestamptz := now();
  v_default_org uuid;
begin
  -- Org padrão para fallback quando current_org_id() é null (rodando no SQL editor sem JWT)
  select coalesce(public.current_org_id(), (select id from public.organizations order by created_at limit 1))
    into v_default_org;
  if v_default_org is null then
    raise exception 'Nenhuma organização encontrada — crie uma em public.organizations antes do backfill';
  end if;

  -- 9.1 op_clientes ativos => ATIVO (cria clients quando não existir)
  insert into public.clients (
    user_id, organization_id, company, contact_name, phone, whatsapp, email,
    pipeline_stage, operations_locked, activated_at, created_from, source_ref,
    onboarding_status, lc_contract_status
  )
  select
    coalesce(oc.responsavel_id, (select id from auth.users limit 1)) as user_id,
    v_default_org as organization_id,
    coalesce(nullif(oc.empresa,''), oc.nome) as company,
    oc.nome, oc.telefone, oc.whatsapp, oc.email,
    'ATIVO'::public.pipeline_stage, false, oc.created_at, 'operacoes', oc.id,
    'concluido'::public.client_onboarding_status,
    'assinado'::public.client_lc_contract_status
  from public.op_clientes oc
  where not exists (
    select 1 from public.clients c where c.created_from='operacoes' and c.source_ref=oc.id
  );

  -- 9.2 contratos assinados sem cliente => IMPLANTACAO
  insert into public.clients (
    user_id, organization_id, company, cnpj, pipeline_stage,
    created_from, source_ref, lc_contract_status, financial_status
  )
  select
    ct.user_id, v_default_org,
    coalesce(ct.cliente_empresa, ct.cliente_nome, 'Cliente'),
    ct.cliente_cnpj,
    'IMPLANTACAO'::public.pipeline_stage,
    'contrato', ct.id,
    'assinado'::public.client_lc_contract_status,
    'confirmado'::public.client_financial_status
  from public.contratos ct
  where ct.status = 'assinado'
    and not exists (select 1 from public.clients c where c.created_from='contrato' and c.source_ref=ct.id);

  -- 9.3 contratos aguardando => ASSINATURA
  insert into public.clients (
    user_id, organization_id, company, cnpj, pipeline_stage,
    created_from, source_ref, lc_contract_status
  )
  select
    ct.user_id, v_default_org,
    coalesce(ct.cliente_empresa, ct.cliente_nome, 'Cliente'),
    ct.cliente_cnpj,
    'ASSINATURA'::public.pipeline_stage,
    'contrato', ct.id,
    'enviado'::public.client_lc_contract_status
  from public.contratos ct
  where ct.status <> 'assinado'
    and not exists (select 1 from public.clients c where c.created_from='contrato' and c.source_ref=ct.id);

  -- 9.4 propostas aprovadas/enviadas => PROPOSTA
  insert into public.clients (
    user_id, organization_id, company, pipeline_stage,
    created_from, source_ref
  )
  select
    p.user_id, v_default_org,
    coalesce(p.titulo, 'Proposta '||left(p.id::text,8)),
    case when p.status = 'aprovada' then 'PROPOSTA' else 'PROPOSTA' end::public.pipeline_stage,
    'proposta', p.id
  from public.proposals p
  where p.status in ('enviada','aprovada','visualizada','expirada')
    and not exists (select 1 from public.clients c where c.created_from='proposta' and c.source_ref=p.id);

  -- 9.5 cad_leads ativos => CADENCIA
  insert into public.clients (
    user_id, organization_id, company, contact_name, phone, whatsapp, email,
    pipeline_stage, created_from, source_ref
  )
  select
    cl.owner_id, coalesce(cl.organization_id, v_default_org),
    cl.empresa, cl.responsavel, cl.telefone, cl.whatsapp, cl.email,
    'CADENCIA'::public.pipeline_stage, 'cadencia', cl.id
  from public.cad_leads cl
  where cl.closed_at is null
    and not exists (select 1 from public.clients c where c.created_from='cadencia' and c.source_ref=cl.id);

  -- Marcar todas as transições de backfill
  update public.client_transitions
     set reason = 'backfill'
   where reason is null and created_at >= v_now;
end $$;