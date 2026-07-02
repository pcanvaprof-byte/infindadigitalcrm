-- ============================================================
-- FASE 1: Motor operacional INFINDA — Briefings + Kickoff + CRM
-- Automações encadeadas: status do prospect + atividades + auto-Kickoff
-- ============================================================

create or replace function public._infinda_log_activity(
  p_lead uuid, p_user uuid, p_kind text, p_text text
) returns void
language sql security definer set search_path = public as $$
  insert into public.prospect_interactions(prospect_id, user_id, kind, text, by_name)
  select p_lead, p_user, p_kind, p_text, 'Dany (IA)'
   where p_lead is not null and p_user is not null;
$$;

create or replace function public.update_briefing_by_token(
  p_token text, p_respostas jsonb, p_status text default null
) returns public.briefings
language plpgsql security definer set search_path = public as $$
declare v_row public.briefings; v_was_concluido boolean;
begin
  select * into v_row from public.briefings where token_publico = p_token limit 1;
  if not found then raise exception 'briefing_not_found'; end if;
  v_was_concluido := (v_row.status = 'concluido');

  update public.briefings
     set respostas_json = coalesce(p_respostas, respostas_json),
         status = case when p_status in ('em_preenchimento','concluido') then p_status else status end
   where token_publico = p_token
   returning * into v_row;

  if not v_was_concluido and v_row.status = 'concluido' and v_row.lead_id is not null then
    if v_row.tipo = 'briefing_comercial' then
      update public.prospects set status = 'diagnostico_pendente', updated_at = now() where id = v_row.lead_id;
      perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
        'Briefing Comercial recebido — pronto para gerar diagnóstico.');
    elsif v_row.tipo = 'kickoff_producao' then
      update public.prospects set status = 'aguardando_producao', updated_at = now() where id = v_row.lead_id;
      perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
        'Kickoff concluído — gerando resumo operacional.');
    end if;
  end if;
  return v_row;
end;
$$;
grant execute on function public.update_briefing_by_token(text, jsonb, text) to anon, authenticated;

create or replace function public.set_briefing_resumo_ia(p_token text, p_resumo text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_row public.briefings;
begin
  update public.briefings set resumo_ia = p_resumo where token_publico = p_token returning * into v_row;
  if v_row.lead_id is null then return; end if;
  if v_row.tipo = 'briefing_comercial' then
    update public.prospects set status = 'proposta_pendente', updated_at = now() where id = v_row.lead_id;
    perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
      'Diagnóstico IA pronto — gerar e enviar proposta comercial.');
  elsif v_row.tipo = 'kickoff_producao' then
    perform public._infinda_log_activity(v_row.lead_id, v_row.user_id, 'nota',
      'Resumo Operacional gerado — projeto pronto para produção.');
  end if;
end;
$$;
grant execute on function public.set_briefing_resumo_ia(text, text) to authenticated, service_role;

create or replace function public._infinda_on_prospect_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_token text; v_has_kickoff boolean;
begin
  if new.status is distinct from old.status and new.status = 'fechado_ganho' then
    select exists(
      select 1 from public.briefings
       where lead_id = new.id and tipo = 'kickoff_producao' and status <> 'cancelado'
    ) into v_has_kickoff;
    if not v_has_kickoff then
      v_token := md5(random()::text || clock_timestamp()::text || new.id::text)
              || md5(random()::text || clock_timestamp()::text || coalesce(new.email, ''));
      insert into public.briefings(
        user_id, tipo, lead_id, cliente_nome, empresa, telefone, email,
        servico, status, token_publico, respostas_json
      ) values (
        new.user_id, 'kickoff_producao', new.id,
        new.owner_name, new.company, new.phone, new.email,
        'gestao_trafego', 'pendente', v_token, '{}'::jsonb
      );
      perform public._infinda_log_activity(new.id, new.user_id, 'nota',
        'Kickoff de Produção criado automaticamente — envie o link ao cliente.');
      new.status := 'aguardando_kickoff';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_infinda_prospect_status on public.prospects;
create trigger trg_infinda_prospect_status
  before update on public.prospects
  for each row execute function public._infinda_on_prospect_status_change();

create or replace function public._infinda_on_briefing_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'briefing_comercial' and new.lead_id is not null then
    update public.prospects
       set status = case when status in ('nao_contatado','primeiro_contato')
                         then 'briefing_enviado' else status end,
           updated_at = now()
     where id = new.lead_id;
    perform public._infinda_log_activity(new.lead_id, new.user_id, 'nota',
      'Briefing Comercial enviado ao cliente.');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_infinda_briefing_created on public.briefings;
create trigger trg_infinda_briefing_created
  after insert on public.briefings
  for each row execute function public._infinda_on_briefing_created();

-- ============================================================
-- CATÁLOGO COMERCIAL
-- ============================================================

do $$ begin create type public.catalog_tipo as enum ('servico','pacote','complemento','bonus');
exception when duplicate_object then null; end $$;
do $$ begin create type public.catalog_cobranca as enum ('implantacao','mensal','avulso');
exception when duplicate_object then null; end $$;
do $$ begin create type public.catalog_complexidade as enum ('baixa','media','alta');
exception when duplicate_object then null; end $$;
do $$ begin create type public.catalog_area as enum ('comercial','marketing','desenvolvimento','design','ia','suporte','outros');
exception when duplicate_object then null; end $$;
do $$ begin create type public.catalog_rel_tipo as enum ('complemento','dependencia');
exception when duplicate_object then null; end $$;

create table if not exists public.catalog_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique, slug text not null unique,
  ordem int not null default 0, ativo boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.catalog_categorias to authenticated;
grant all on public.catalog_categorias to service_role;
alter table public.catalog_categorias enable row level security;
drop policy if exists "catalog_categorias read" on public.catalog_categorias;
create policy "catalog_categorias read" on public.catalog_categorias for select to authenticated using (true);
drop policy if exists "catalog_categorias write" on public.catalog_categorias;
create policy "catalog_categorias write" on public.catalog_categorias for all to authenticated using (true) with check (true);

insert into public.catalog_categorias (nome, slug, ordem) values
  ('Gestão de Tráfego','gestao-trafego',10),('Desenvolvimento','desenvolvimento',20),
  ('Websites','websites',30),('Landing Pages','landing-pages',40),
  ('E-commerce','ecommerce',50),('CRM','crm',60),
  ('Automações','automacoes',70),('Agentes IA','agentes-ia',80),
  ('Identidade Visual','identidade-visual',90),('Branding','branding',100),
  ('Consultorias','consultorias',110),('Mentorias','mentorias',120),
  ('Suporte','suporte',130),('Outros','outros',999)
on conflict (slug) do nothing;

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  tipo public.catalog_tipo not null default 'servico',
  codigo text unique, nome_comercial text not null, nome_interno text,
  categoria_id uuid references public.catalog_categorias(id) on delete restrict,
  subcategoria text, descricao_curta text, descricao_completa text,
  beneficios text[] not null default '{}', entregaveis text[] not null default '{}',
  nao_incluso text[] not null default '{}',
  prazo_estimado_dias int, complexidade public.catalog_complexidade not null default 'media',
  prioridade int not null default 0, area_responsavel public.catalog_area not null default 'comercial',
  tempo_execucao_horas numeric(10,2), objetivo text,
  cobranca public.catalog_cobranca not null default 'implantacao',
  valor_implantacao numeric(12,2) not null default 0,
  valor_mensal numeric(12,2) not null default 0,
  valor_avulso numeric(12,2) not null default 0,
  ativo boolean not null default true, ordem int not null default 0,
  tags text[] not null default '{}', observacoes_internas text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.catalog_items to authenticated;
grant all on public.catalog_items to service_role;
alter table public.catalog_items enable row level security;
drop policy if exists "catalog_items read" on public.catalog_items;
create policy "catalog_items read" on public.catalog_items for select to authenticated using (true);
drop policy if exists "catalog_items write" on public.catalog_items;
create policy "catalog_items write" on public.catalog_items for all to authenticated using (true) with check (true);
create index if not exists idx_catalog_items_categoria on public.catalog_items(categoria_id);
create index if not exists idx_catalog_items_tipo on public.catalog_items(tipo);
create index if not exists idx_catalog_items_ativo on public.catalog_items(ativo);

create table if not exists public.catalog_relacionamentos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.catalog_items(id) on delete cascade,
  relacionado_id uuid not null references public.catalog_items(id) on delete cascade,
  tipo public.catalog_rel_tipo not null, ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (item_id, relacionado_id, tipo), check (item_id <> relacionado_id)
);
grant select, insert, update, delete on public.catalog_relacionamentos to authenticated;
grant all on public.catalog_relacionamentos to service_role;
alter table public.catalog_relacionamentos enable row level security;
drop policy if exists "catalog_rel read" on public.catalog_relacionamentos;
create policy "catalog_rel read" on public.catalog_relacionamentos for select to authenticated using (true);
drop policy if exists "catalog_rel write" on public.catalog_relacionamentos;
create policy "catalog_rel write" on public.catalog_relacionamentos for all to authenticated using (true) with check (true);

create or replace function public.catalog_items_set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_catalog_items_updated_at on public.catalog_items;
create trigger trg_catalog_items_updated_at before update on public.catalog_items
  for each row execute function public.catalog_items_set_updated_at();

-- ============================================================
-- CRM: clients, deals, deal_stages, deal_activities
-- ============================================================

create table if not exists public.deal_stages (
  id text primary key, label text not null, tone text,
  position int not null, is_won boolean not null default false, is_lost boolean not null default false
);
grant select on public.deal_stages to anon, authenticated;
grant all on public.deal_stages to service_role;
alter table public.deal_stages enable row level security;
drop policy if exists "deal_stages public read" on public.deal_stages;
create policy "deal_stages public read" on public.deal_stages for select to anon, authenticated using (true);

insert into public.deal_stages (id, label, tone, position, is_won, is_lost) values
  ('lead','Lead','oklch(0.7 0.04 250)',1,false,false),
  ('contato','Contato Feito','oklch(0.72 0.12 220)',2,false,false),
  ('qualificado','Qualificado','oklch(0.72 0.14 200)',3,false,false),
  ('apresentacao','Apresentação','oklch(0.7 0.18 264)',4,false,false),
  ('reuniao','Reunião','oklch(0.72 0.18 290)',5,false,false),
  ('proposta','Proposta','oklch(0.78 0.16 75)',6,false,false),
  ('negociacao','Negociação','oklch(0.72 0.18 35)',7,false,false),
  ('fechado','Fechado','oklch(0.7 0.17 158)',8,true,false),
  ('perdido','Perdido','oklch(0.62 0.15 25)',9,false,true)
on conflict (id) do nothing;

alter table public.deal_stages
  add column if not exists is_meeting boolean not null default false,
  add column if not exists is_proposal boolean not null default false;
update public.deal_stages set is_meeting = true where id in ('reuniao','apresentacao');
update public.deal_stages set is_proposal = true where id in ('proposta','negociacao');

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid unique references public.prospects(id) on delete set null,
  company text not null, cnpj text, segment text, contact_name text,
  whatsapp text, phone text, email text, instagram text,
  city text, state text, owner_name text,
  tags text[] not null default '{}', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists clients_user_cnpj_uniq on public.clients(user_id, cnpj) where cnpj is not null and cnpj <> '';
create index if not exists clients_user_idx on public.clients(user_id);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
drop policy if exists "clients owner all" on public.clients;
create policy "clients owner all" on public.clients for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  title text not null, value numeric(14,2) not null default 0,
  stage_id text not null references public.deal_stages(id) default 'lead',
  owner_name text, expected_close date, closed_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists deals_user_idx on public.deals(user_id);
create index if not exists deals_client_idx on public.deals(client_id);
create index if not exists deals_stage_idx on public.deals(user_id, stage_id);
grant select, insert, update, delete on public.deals to authenticated;
grant all on public.deals to service_role;
alter table public.deals enable row level security;
drop policy if exists "deals owner all" on public.deals;
create policy "deals owner all" on public.deals for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind text not null, text text, meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists deal_activities_deal_idx on public.deal_activities(deal_id, created_at desc);
grant select, insert, update, delete on public.deal_activities to authenticated;
grant all on public.deal_activities to service_role;
alter table public.deal_activities enable row level security;
drop policy if exists "deal_activities owner all" on public.deal_activities;
create policy "deal_activities owner all" on public.deal_activities for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public._infinda_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients for each row execute function public._infinda_touch_updated_at();
drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before update on public.deals for each row execute function public._infinda_touch_updated_at();

create or replace function public._infinda_log_deal_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    insert into public.deal_activities(user_id, deal_id, kind, text, meta)
    values (new.user_id, new.id, 'stage_change',
      format('Estágio: %s → %s', old.stage_id, new.stage_id),
      jsonb_build_object('from', old.stage_id, 'to', new.stage_id));
    if exists (select 1 from public.deal_stages s where s.id = new.stage_id and (s.is_won or s.is_lost)) then
      new.closed_at = coalesce(new.closed_at, now());
    else new.closed_at = null; end if;
  end if;
  return new;
end $$;
drop trigger if exists deals_stage_log on public.deals;
create trigger deals_stage_log before update on public.deals for each row execute function public._infinda_log_deal_stage();

drop function if exists public.convert_prospect_to_client(uuid, numeric, text);
create or replace function public.convert_prospect_to_client(
  p_prospect_id uuid, p_deal_value numeric default 0, p_deal_title text default null
) returns table (client_id uuid, deal_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prospect public.prospects; v_client public.clients; v_deal public.deals;
  v_created boolean := false;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  select * into v_prospect from public.prospects where id = p_prospect_id and user_id = v_uid;
  if not found then raise exception 'prospect_not_found'; end if;

  select * into v_client from public.clients
    where user_id = v_uid and (prospect_id = p_prospect_id
      or (v_prospect.cnpj is not null and v_prospect.cnpj <> '' and cnpj = v_prospect.cnpj))
    limit 1;

  if not found then
    insert into public.clients(user_id, prospect_id, company, cnpj, segment, contact_name,
      whatsapp, phone, email, instagram, city, state, owner_name, notes)
    values (v_uid, v_prospect.id, v_prospect.company, nullif(v_prospect.cnpj,''),
      v_prospect.segment, v_prospect.owner_name, v_prospect.whatsapp, v_prospect.phone,
      v_prospect.email, v_prospect.instagram, v_prospect.city, v_prospect.state, v_prospect.owner_name,
      'Convertido do prospect em ' || to_char(now(),'DD/MM/YYYY HH24:MI'))
    returning * into v_client;
    v_created := true;
  end if;

  select * into v_deal from public.deals
    where user_id = v_uid and client_id = v_client.id and closed_at is null
    order by created_at desc limit 1;
  if not found then
    insert into public.deals(user_id, client_id, prospect_id, title, value, stage_id, owner_name)
    values (v_uid, v_client.id, v_prospect.id, coalesce(p_deal_title, v_prospect.company),
      coalesce(p_deal_value, 0), 'lead', v_prospect.owner_name)
    returning * into v_deal;
    insert into public.deal_activities(user_id, deal_id, kind, text)
    values (v_uid, v_deal.id, 'note', 'Deal criado a partir do prospect ' || v_prospect.company);
  end if;

  update public.prospects set status = 'cliente', updated_at = now() where id = v_prospect.id;
  insert into public.prospect_interactions(prospect_id, user_id, kind, text, by_name)
  values (v_prospect.id, v_uid, 'nota',
    case when v_created then 'Convertido em cliente' else 'Cliente já existia — vínculo reforçado' end, 'Sistema');
  return query select v_client.id, v_deal.id, v_created;
end $$;
grant execute on function public.convert_prospect_to_client(uuid, numeric, text) to authenticated;

alter table public.briefings add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists briefings_client_idx on public.briefings(client_id);

-- ============================================================
-- FASE 6: Cadência + prospect_touchpoints + dashboard
-- ============================================================

alter table public.prospects
  add column if not exists cadence_step smallint not null default 0,
  add column if not exists cadence_status text not null default 'ativo',
  add column if not exists response_status text not null default 'sem_resposta',
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_contact_at timestamptz,
  add column if not exists closed_reason text,
  add column if not exists closed_at timestamptz;

do $$ begin alter table public.prospects add constraint prospects_cadence_step_chk check (cadence_step between 0 and 6);
exception when duplicate_object then null; end $$;
do $$ begin alter table public.prospects add constraint prospects_cadence_status_chk check (cadence_status in ('ativo','pausado','encerrado'));
exception when duplicate_object then null; end $$;
do $$ begin alter table public.prospects add constraint prospects_response_status_chk check (response_status in ('sem_resposta','respondeu','interessado','sem_interesse','cliente'));
exception when duplicate_object then null; end $$;

create index if not exists prospects_next_contact_idx on public.prospects (user_id, next_contact_at);
create index if not exists prospects_response_idx on public.prospects (user_id, response_status);
create index if not exists prospects_cadence_idx on public.prospects (user_id, cadence_status);

create table if not exists public.prospect_touchpoints (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('whatsapp','ligacao','email','reuniao','nota')),
  mensagem text,
  resultado text not null default 'enviado'
    check (resultado in ('tentativa','enviado','respondido','interessado','sem_interesse','sem_resposta')),
  enviado_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.prospect_touchpoints to authenticated;
grant all on public.prospect_touchpoints to service_role;
alter table public.prospect_touchpoints enable row level security;
drop policy if exists "touchpoints owner read" on public.prospect_touchpoints;
create policy "touchpoints owner read" on public.prospect_touchpoints for select to authenticated using (user_id = auth.uid());
drop policy if exists "touchpoints owner insert" on public.prospect_touchpoints;
create policy "touchpoints owner insert" on public.prospect_touchpoints for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "touchpoints owner update" on public.prospect_touchpoints;
create policy "touchpoints owner update" on public.prospect_touchpoints for update to authenticated using (user_id = auth.uid());
drop policy if exists "touchpoints owner delete" on public.prospect_touchpoints;
create policy "touchpoints owner delete" on public.prospect_touchpoints for delete to authenticated using (user_id = auth.uid());
create index if not exists prospect_touchpoints_prospect_idx on public.prospect_touchpoints (prospect_id, enviado_em desc);
create index if not exists prospect_touchpoints_user_idx on public.prospect_touchpoints (user_id, enviado_em desc);

create or replace function public.advance_prospect_cadence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  intervals int[] := array[1,3,7,15,21];
  cur_step smallint; nxt_step smallint; nxt_at timestamptz;
  new_resp text; new_cad text;
begin
  if new.resultado = 'tentativa' or new.tipo = 'nota' then return new; end if;
  select cadence_step into cur_step from prospects where id = new.prospect_id;
  nxt_step := least(coalesce(cur_step,0) + 1, 6);
  if new.resultado = 'sem_interesse' or nxt_step >= 6 then
    nxt_at := null; new_cad := 'encerrado';
  elsif new.resultado = 'interessado' then
    nxt_at := null; new_cad := 'ativo';
  else
    nxt_at := new.enviado_em + (intervals[nxt_step] || ' days')::interval;
    new_cad := 'ativo';
  end if;
  new_resp := case new.resultado
    when 'respondido' then 'respondeu' when 'interessado' then 'interessado'
    when 'sem_interesse' then 'sem_interesse' else null end;
  update prospects set
    cadence_step = nxt_step, cadence_status = new_cad,
    last_contact_at = new.enviado_em, next_contact_at = nxt_at,
    response_status = coalesce(new_resp, response_status),
    closed_at = case when new_cad = 'encerrado' then now() else closed_at end,
    closed_reason = case when new.resultado = 'sem_interesse' then 'sem_interesse'
                          when nxt_step >= 6 then 'cadencia_concluida' else closed_reason end,
    updated_at = now()
  where id = new.prospect_id;
  return new;
end $$;

drop trigger if exists prospect_touchpoint_advance on public.prospect_touchpoints;
create trigger prospect_touchpoint_advance after insert on public.prospect_touchpoints
  for each row execute function public.advance_prospect_cadence();

create or replace function public.dashboard_metrics()
returns jsonb language sql stable security definer set search_path = public as $$
  with
  p as (select * from prospects where user_id = auth.uid()),
  t_all as (select * from prospect_touchpoints where user_id = auth.uid()),
  t as (select * from t_all where resultado <> 'tentativa'),
  ttry as (select * from t_all where resultado = 'tentativa'),
  d as (select d.*, s.is_won, s.is_lost, s.is_meeting, s.is_proposal
        from deals d left join deal_stages s on s.id = d.stage_id where d.user_id = auth.uid())
  select jsonb_build_object(
    'operacao', jsonb_build_object(
      'base',(select count(*) from p),
      'contatadas',(select count(*) from p where last_contact_at is not null),
      'sem_resposta',(select count(*) from p where response_status='sem_resposta' and last_contact_at is not null),
      'interessadas',(select count(*) from p where response_status in ('interessado','cliente')),
      'clientes',(select count(*) from p where response_status='cliente')),
    'cadencia', jsonb_build_object(
      'hoje',(select count(*) from t where enviado_em >= date_trunc('day', now())),
      'semana',(select count(*) from t where enviado_em >= date_trunc('week', now())),
      'mes',(select count(*) from t where enviado_em >= date_trunc('month', now())),
      'taxa_resposta', coalesce((select round(100.0*count(*) filter (where response_status <> 'sem_resposta') / nullif(count(*),0),1) from p where last_contact_at is not null),0),
      'taxa_interesse', coalesce((select round(100.0*count(*) filter (where response_status in ('interessado','cliente')) / nullif(count(*),0),1) from p where last_contact_at is not null),0),
      'taxa_fechamento', coalesce((select round(100.0*count(*) filter (where response_status='cliente') / nullif(count(*),0),1) from p),0)),
    'tentativas', jsonb_build_object(
      'hoje',(select count(*) from ttry where enviado_em >= date_trunc('day', now())),
      'semana',(select count(*) from ttry where enviado_em >= date_trunc('week', now())),
      'mes',(select count(*) from ttry where enviado_em >= date_trunc('month', now()))),
    'gargalos', jsonb_build_object(
      'atrasados',(select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'parados_30d',(select count(*) from p where last_contact_at < now() - interval '30 days'),
      'sem_responsavel',(select count(*) from p where coalesce(nullif(owner_name,''),null) is null),
      'deals_paradas_15d',(select count(*) from d where updated_at < now() - interval '15 days' and coalesce(is_won,false)=false and coalesce(is_lost,false)=false)),
    'conversao', jsonb_build_object(
      'base_contato', coalesce((select round(100.0*count(*) filter (where last_contact_at is not null) / nullif(count(*),0),1) from p),0),
      'contato_interesse', coalesce((select round(100.0*count(*) filter (where response_status in ('interessado','cliente')) / nullif(count(*),0),1) from p where last_contact_at is not null),0),
      'interesse_reuniao', coalesce((select round(100.0*count(*) filter (where is_meeting=true) / nullif(count(*),0),1) from d),0),
      'reuniao_proposta', coalesce((select round(100.0*count(*) filter (where is_proposal=true) / nullif(count(*) filter (where is_meeting=true),0),1) from d),0),
      'proposta_cliente', coalesce((select round(100.0*count(*) filter (where coalesce(is_won,false)=true) / nullif(count(*) filter (where is_proposal=true),0),1) from d),0)),
    'filtros', jsonb_build_object(
      'hoje',(select count(*) from p where cadence_status='ativo' and next_contact_at::date = current_date),
      'atrasados',(select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'sem_resposta',(select count(*) from p where response_status='sem_resposta' and last_contact_at is not null),
      'responderam',(select count(*) from p where response_status in ('respondeu','interessado','cliente')),
      'interessados',(select count(*) from p where response_status='interessado'),
      'clientes',(select count(*) from p where response_status='cliente'))
  );
$$;
grant execute on function public.dashboard_metrics() to authenticated;

create or replace function public.acoes_hoje(_limit int default 100)
returns table (id uuid, company text, whatsapp text, cadence_step smallint,
  last_contact_at timestamptz, next_contact_at timestamptz, dias_atraso int)
language sql stable security definer set search_path = public as $$
  select id, company, whatsapp, cadence_step, last_contact_at, next_contact_at,
    case when next_contact_at < now()
         then greatest(0, floor(extract(epoch from (now() - next_contact_at))/86400)::int)
         else 0 end as dias_atraso
  from prospects
  where user_id = auth.uid() and cadence_status = 'ativo'
    and next_contact_at is not null and next_contact_at <= (current_date + interval '1 day')
  order by next_contact_at asc nulls last limit _limit;
$$;
grant execute on function public.acoes_hoje(int) to authenticated;

create or replace function public.snooze_prospect(_prospect_id uuid, _days int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_next timestamptz;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  v_next := coalesce((select next_contact_at from prospects where id = _prospect_id and user_id = v_uid), now())
            + (_days || ' days')::interval;
  update prospects set next_contact_at = v_next, cadence_status = 'ativo', updated_at = now()
   where id = _prospect_id and user_id = v_uid;
  return v_next;
end $$;
grant execute on function public.snooze_prospect(uuid, int) to authenticated;

create or replace function public.close_cadence(_prospect_id uuid, _reason text, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if _reason not in ('sem_interesse','numero_invalido','empresa_fechada','cliente','outro') then
    raise exception 'reason_invalido: %', _reason; end if;
  update prospects set
    cadence_status = 'encerrado', cadence_step = 6, next_contact_at = null,
    closed_at = now(), closed_reason = _reason,
    response_status = case when _reason='cliente' then 'cliente'
                            when _reason='sem_interesse' then 'sem_interesse' else response_status end,
    updated_at = now()
  where id = _prospect_id and user_id = v_uid;
  insert into public.prospect_touchpoints(prospect_id, user_id, tipo, mensagem, resultado)
  values (_prospect_id, v_uid, 'nota',
    'Cadência encerrada: ' || _reason || coalesce(' — ' || _note, ''),
    case _reason when 'sem_interesse' then 'sem_interesse'
                 when 'cliente' then 'interessado' else 'enviado' end);
end $$;
grant execute on function public.close_cadence(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
