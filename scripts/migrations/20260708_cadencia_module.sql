-- ============================================================================
-- Cadência Comercial — módulo independente
-- Não altera prospects/CRM/propostas. Tabelas isoladas com prefixo cad_.
-- ============================================================================

-- 1) Enums --------------------------------------------------------------------
do $$ begin
  create type public.cad_stage as enum (
    'followup_1','followup_2','followup_3','followup_4',
    'followup_5','followup_6','followup_7',
    'interessado','reuniao_agendada','proposta_enviada',
    'negociacao','fechado','perdido'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cad_temp as enum ('quente','morno','frio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cad_msg_tipo as enum ('whatsapp','email','ligacao','nota','sistema');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cad_msg_direction as enum ('out','in','system');
exception when duplicate_object then null; end $$;

-- 2) cad_leads ----------------------------------------------------------------
create table if not exists public.cad_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id()
    references public.organizations(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,

  empresa text not null,
  responsavel text,
  cargo text,
  telefone text,
  whatsapp text,
  email text,

  stage public.cad_stage not null default 'followup_1',
  temperatura public.cad_temp not null default 'morno',

  primeira_abordagem_at timestamptz not null default now(),
  last_contact_at timestamptz,
  next_action_at timestamptz default (now() + interval '3 days'),
  last_response_at timestamptz,

  closed_at timestamptz,
  closed_reason text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cad_leads_org on public.cad_leads(organization_id);
create index if not exists idx_cad_leads_owner on public.cad_leads(owner_id);
create index if not exists idx_cad_leads_stage on public.cad_leads(stage);
create index if not exists idx_cad_leads_next_action on public.cad_leads(next_action_at);
create unique index if not exists ux_cad_leads_prospect on public.cad_leads(prospect_id) where prospect_id is not null;

grant select, insert, update, delete on public.cad_leads to authenticated;
grant all on public.cad_leads to service_role;

alter table public.cad_leads enable row level security;

drop policy if exists cad_leads_select on public.cad_leads;
create policy cad_leads_select on public.cad_leads
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists cad_leads_insert on public.cad_leads;
create policy cad_leads_insert on public.cad_leads
  for insert to authenticated
  with check (organization_id = public.current_org_id() and owner_id = auth.uid());

drop policy if exists cad_leads_update on public.cad_leads;
create policy cad_leads_update on public.cad_leads
  for update to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists cad_leads_delete on public.cad_leads;
create policy cad_leads_delete on public.cad_leads
  for delete to authenticated
  using (organization_id = public.current_org_id());

-- updated_at trigger
create or replace function public.cad_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_cad_leads_updated_at on public.cad_leads;
create trigger trg_cad_leads_updated_at
  before update on public.cad_leads
  for each row execute function public.cad_set_updated_at();

-- 3) cad_messages -------------------------------------------------------------
create table if not exists public.cad_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id()
    references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.cad_leads(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,

  tipo public.cad_msg_tipo not null,
  direction public.cad_msg_direction not null default 'out',
  stage_at_send public.cad_stage,

  mensagem text,
  status text not null default 'enviada',
  created_at timestamptz not null default now()
);

create index if not exists idx_cad_messages_lead on public.cad_messages(lead_id, created_at desc);
create index if not exists idx_cad_messages_org on public.cad_messages(organization_id);

grant select, insert, update, delete on public.cad_messages to authenticated;
grant all on public.cad_messages to service_role;

alter table public.cad_messages enable row level security;

drop policy if exists cad_messages_select on public.cad_messages;
create policy cad_messages_select on public.cad_messages
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists cad_messages_insert on public.cad_messages;
create policy cad_messages_insert on public.cad_messages
  for insert to authenticated
  with check (organization_id = public.current_org_id());

drop policy if exists cad_messages_update on public.cad_messages;
create policy cad_messages_update on public.cad_messages
  for update to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists cad_messages_delete on public.cad_messages;
create policy cad_messages_delete on public.cad_messages
  for delete to authenticated
  using (organization_id = public.current_org_id());

-- 4) cad_templates ------------------------------------------------------------
create table if not exists public.cad_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id()
    references public.organizations(id) on delete cascade,
  stage public.cad_stage not null,
  titulo text not null,
  corpo text not null,
  updated_at timestamptz not null default now(),
  unique (organization_id, stage)
);

grant select, insert, update, delete on public.cad_templates to authenticated;
grant all on public.cad_templates to service_role;

alter table public.cad_templates enable row level security;

drop policy if exists cad_templates_select on public.cad_templates;
create policy cad_templates_select on public.cad_templates
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists cad_templates_write on public.cad_templates;
create policy cad_templates_write on public.cad_templates
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop trigger if exists trg_cad_templates_updated_at on public.cad_templates;
create trigger trg_cad_templates_updated_at
  before update on public.cad_templates
  for each row execute function public.cad_set_updated_at();

-- 5) Seed templates por org ---------------------------------------------------
create or replace function public.cad_seed_templates(p_org uuid)
returns void language plpgsql as $$
begin
  insert into public.cad_templates (organization_id, stage, titulo, corpo) values
  (p_org, 'followup_1', 'Follow-up 1 — Confirmar visualização',
'Olá {{responsavel}}, tudo bem?

Há alguns dias entrei em contato com a {{empresa}} porque identifiquei oportunidades de crescimento através de marketing digital e automação.

Conseguiu visualizar minha mensagem anterior?

Posso te mostrar algumas ideias rapidamente.'),
  (p_org, 'followup_2', 'Follow-up 2 — Gerar curiosidade',
'Olá {{responsavel}}, tudo bem?

Notei alguns pontos na {{empresa}} que podem estar limitando a geração de oportunidades.

Posso compartilhar rapidamente.'),
  (p_org, 'followup_3', 'Follow-up 3 — Mostrar oportunidade',
'Olá {{responsavel}}, tenho ajudado empresas como a {{empresa}} a aumentar vendas com presença digital estruturada e tráfego pago.

Posso te mostrar como aplicar isso aí?'),
  (p_org, 'followup_4', 'Follow-up 4 — Benefício',
'{{responsavel}}, automatizar parte do comercial e do marketing libera o time da {{empresa}} para focar no que gera receita.

Quer que eu te mostre o que faz mais sentido começar primeiro?'),
  (p_org, 'followup_5', 'Follow-up 5 — Autoridade',
'Olá {{responsavel}}, separei alguns resultados e cases de empresas parecidas com a {{empresa}}.

Posso te mandar?'),
  (p_org, 'followup_6', 'Follow-up 6 — Convite para reunião',
'{{responsavel}}, faz sentido marcarmos 20 minutos para eu te mostrar como podemos acelerar o crescimento da {{empresa}}?

Tenho horário esta semana.'),
  (p_org, 'followup_7', 'Follow-up 7 — Encerramento',
'Olá {{responsavel}}.

Como não obtive retorno, vou encerrar meus contatos por enquanto.

Caso faça sentido no futuro conversar sobre crescimento, tráfego pago, automações ou presença digital, fico à disposição.

Grande abraço.'),
  (p_org, 'interessado', 'Interessado — agendar conversa',
'Que ótimo, {{responsavel}}! Vou te enviar agora algumas opções de horário para a gente conversar sobre a {{empresa}}.'),
  (p_org, 'reuniao_agendada', 'Reunião agendada — confirmar',
'{{responsavel}}, só confirmando nossa reunião. Qualquer ajuste me avise por aqui.'),
  (p_org, 'proposta_enviada', 'Proposta enviada — follow',
'{{responsavel}}, te enviei a proposta. Posso te ligar para tirar dúvidas?'),
  (p_org, 'negociacao', 'Negociação',
'{{responsavel}}, conseguimos fechar os pontos pendentes da proposta da {{empresa}}?'),
  (p_org, 'fechado', 'Boas-vindas',
'{{responsavel}}, bem-vindo! Vamos começar os trabalhos da {{empresa}}.'),
  (p_org, 'perdido', 'Encerramento — perdido',
'{{responsavel}}, obrigado pelo retorno. Fico à disposição.')
  on conflict (organization_id, stage) do nothing;
end $$;

-- backfill para orgs existentes
do $$ declare r record; begin
  for r in select id from public.organizations loop
    perform public.cad_seed_templates(r.id);
  end loop;
end $$;

-- trigger: nova org recebe templates
create or replace function public.cad_handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.cad_seed_templates(new.id); return new; end $$;

drop trigger if exists trg_cad_new_org on public.organizations;
create trigger trg_cad_new_org
  after insert on public.organizations
  for each row execute function public.cad_handle_new_org();

-- 6) Cronograma + RPCs --------------------------------------------------------
-- dias do próximo follow-up a partir de primeira_abordagem_at
create or replace function public.cad_next_action_for_stage(p_stage public.cad_stage, p_base timestamptz)
returns timestamptz language sql immutable as $$
  select case p_stage
    when 'followup_1' then p_base + interval '3 days'
    when 'followup_2' then p_base + interval '7 days'
    when 'followup_3' then p_base + interval '10 days'
    when 'followup_4' then p_base + interval '14 days'
    when 'followup_5' then p_base + interval '18 days'
    when 'followup_6' then p_base + interval '24 days'
    when 'followup_7' then p_base + interval '30 days'
    else null
  end
$$;

-- próxima etapa na sequência de follow-ups
create or replace function public.cad_next_stage(p_stage public.cad_stage)
returns public.cad_stage language sql immutable as $$
  select case p_stage
    when 'followup_1' then 'followup_2'::public.cad_stage
    when 'followup_2' then 'followup_3'::public.cad_stage
    when 'followup_3' then 'followup_4'::public.cad_stage
    when 'followup_4' then 'followup_5'::public.cad_stage
    when 'followup_5' then 'followup_6'::public.cad_stage
    when 'followup_6' then 'followup_7'::public.cad_stage
    else p_stage
  end
$$;

-- registra mensagem enviada, atualiza last_contact_at e agenda próximo passo
create or replace function public.cad_register_send(
  p_lead uuid,
  p_tipo public.cad_msg_tipo,
  p_mensagem text,
  p_advance boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_lead public.cad_leads%rowtype;
  v_msg_id uuid;
  v_next_stage public.cad_stage;
  v_next_at timestamptz;
begin
  select * into v_lead from public.cad_leads where id = p_lead;
  if not found then raise exception 'lead não encontrado'; end if;

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, p_tipo, 'out', v_lead.stage, p_mensagem, 'enviada')
  returning id into v_msg_id;

  if p_advance and v_lead.stage::text like 'followup_%' then
    v_next_stage := public.cad_next_stage(v_lead.stage);
    v_next_at := public.cad_next_action_for_stage(v_next_stage, now());
    update public.cad_leads
       set last_contact_at = now(),
           stage = v_next_stage,
           next_action_at = v_next_at
     where id = p_lead;
  else
    update public.cad_leads
       set last_contact_at = now()
     where id = p_lead;
  end if;

  return v_msg_id;
end $$;

grant execute on function public.cad_register_send(uuid, public.cad_msg_tipo, text, boolean) to authenticated;

-- registra resposta recebida (entrada de mensagem)
create or replace function public.cad_register_response(
  p_lead uuid,
  p_mensagem text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead public.cad_leads%rowtype; v_id uuid;
begin
  select * into v_lead from public.cad_leads where id = p_lead;
  if not found then raise exception 'lead não encontrado'; end if;

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, 'whatsapp', 'in', v_lead.stage, p_mensagem, 'respondida')
  returning id into v_id;

  update public.cad_leads
     set last_response_at = now(),
         temperatura = 'quente'
   where id = p_lead;

  return v_id;
end $$;

grant execute on function public.cad_register_response(uuid, text) to authenticated;

-- move lead para etapa específica
create or replace function public.cad_move_stage(p_lead uuid, p_stage public.cad_stage)
returns void language plpgsql security definer set search_path = public as $$
declare v_lead public.cad_leads%rowtype;
begin
  select * into v_lead from public.cad_leads where id = p_lead;
  if not found then raise exception 'lead não encontrado'; end if;

  update public.cad_leads
     set stage = p_stage,
         closed_at = case when p_stage in ('fechado','perdido') then now() else null end
   where id = p_lead;

  insert into public.cad_messages (lead_id, organization_id, tipo, direction, stage_at_send, mensagem, status)
  values (p_lead, v_lead.organization_id, 'sistema', 'system', p_stage,
          'Movido de ' || v_lead.stage::text || ' para ' || p_stage::text, 'enviada');
end $$;

grant execute on function public.cad_move_stage(uuid, public.cad_stage) to authenticated;

-- importa prospects ainda não importados
create or replace function public.cad_import_from_prospects(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into public.cad_leads (
    organization_id, owner_id, prospect_id, empresa, responsavel, cargo, telefone, whatsapp,
    primeira_abordagem_at, stage, next_action_at
  )
  select
    public.current_org_id(),
    auth.uid(),
    p.id,
    coalesce(p.company, 'Sem nome'),
    p.owner_name,
    null::text,
    p.phone,
    p.whatsapp,
    coalesce(p.created_at, now()),
    'followup_1',
    now() + interval '3 days'
  from public.prospects p
  where (p.organization_id is null or p.organization_id = public.current_org_id())
    and (p_ids is null or p.id = any(p_ids))
    and not exists (select 1 from public.cad_leads cl where cl.prospect_id = p.id);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.cad_import_from_prospects(uuid[]) to authenticated;

-- métricas do dashboard
create or replace function public.cad_dashboard_metrics()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_org uuid := public.current_org_id();
  v_total int;
  v_by_stage jsonb;
  v_perdidos int;
  v_total_msgs int;
  v_total_resp int;
  v_total_fech int;
  v_taxa_resp numeric;
  v_taxa_conv numeric;
  v_serie jsonb;
begin
  select count(*) into v_total from public.cad_leads where organization_id = v_org;

  select coalesce(jsonb_object_agg(stage, c), '{}'::jsonb) into v_by_stage
  from (
    select stage::text as stage, count(*) c
    from public.cad_leads
    where organization_id = v_org
    group by stage
  ) s;

  select count(*) into v_perdidos from public.cad_leads
    where organization_id = v_org and stage = 'perdido';

  select count(*) into v_total_msgs from public.cad_messages
    where organization_id = v_org and direction = 'out';

  select count(distinct lead_id) into v_total_resp from public.cad_messages
    where organization_id = v_org and direction = 'in';

  select count(*) into v_total_fech from public.cad_leads
    where organization_id = v_org and stage = 'fechado';

  v_taxa_resp := case when v_total > 0 then round(v_total_resp::numeric * 100 / v_total, 1) else 0 end;
  v_taxa_conv := case when v_total > 0 then round(v_total_fech::numeric * 100 / v_total, 1) else 0 end;

  select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'enviadas', enviadas, 'respostas', respostas) order by dia), '[]'::jsonb)
    into v_serie
  from (
    select d::date as dia,
      (select count(*) from public.cad_messages m
         where m.organization_id = v_org and m.direction='out' and m.created_at::date = d::date) as enviadas,
      (select count(*) from public.cad_messages m
         where m.organization_id = v_org and m.direction='in' and m.created_at::date = d::date) as respostas
    from generate_series((now() - interval '29 days')::date, now()::date, interval '1 day') d
  ) s;

  return jsonb_build_object(
    'total', v_total,
    'by_stage', v_by_stage,
    'taxa_resposta', v_taxa_resp,
    'taxa_conversao', v_taxa_conv,
    'total_mensagens', v_total_msgs,
    'serie_30d', v_serie
  );
end $$;

grant execute on function public.cad_dashboard_metrics() to authenticated;