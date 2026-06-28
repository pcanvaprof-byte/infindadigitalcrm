-- ============================================================
-- Onda 1 — Dashboard > Resumo: escopo ÚNICO por organização,
-- "Responderam" sem dupla contagem, buckets exaustivos e
-- mutuamente exclusivos, fail-closed quando não há organização
-- ativa, integridade de source_ref em conversões.
--
-- Estritamente ADITIVA. Não apaga dados.
-- Aplicar via SQL Editor.
-- ============================================================

begin;
set local check_function_bodies = off;

-- ------------------------------------------------------------
-- 1) source_ref / created_from — backfill de clients vindos de
-- prospects via convert_prospect_to_client (que historicamente
-- só preenchia prospect_id). Item 2 + 6 da Onda 1.
-- ------------------------------------------------------------
update public.clients
   set source_ref   = prospect_id,
       created_from = coalesce(created_from, 'prospect')
 where source_ref is null
   and prospect_id is not null;

-- ------------------------------------------------------------
-- 2) convert_prospect_to_client passa a preencher source_ref +
-- created_from sempre que existir prospect de origem.
-- ------------------------------------------------------------
drop function if exists public.convert_prospect_to_client(uuid, numeric, text);
create or replace function public.convert_prospect_to_client(
  p_prospect_id uuid,
  p_deal_value numeric default 0,
  p_deal_title text default null
) returns table (client_id uuid, deal_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prospect public.prospects;
  v_client public.clients;
  v_deal public.deals;
  v_created boolean := false;
begin
  if v_uid is null then raise exception 'auth_required'; end if;

  select * into v_prospect from public.prospects
    where id = p_prospect_id and user_id = v_uid;
  if not found then raise exception 'prospect_not_found'; end if;

  select * into v_client from public.clients
    where user_id = v_uid
      and (prospect_id = p_prospect_id
           or (v_prospect.cnpj is not null and v_prospect.cnpj <> '' and cnpj = v_prospect.cnpj))
    limit 1;

  if not found then
    insert into public.clients(
      user_id, prospect_id, company, cnpj, segment, contact_name,
      whatsapp, phone, email, instagram, city, state, owner_name, notes,
      created_from, source_ref
    ) values (
      v_uid, v_prospect.id, v_prospect.company, nullif(v_prospect.cnpj,''),
      v_prospect.segment, v_prospect.owner_name,
      v_prospect.whatsapp, v_prospect.phone, v_prospect.email, v_prospect.instagram,
      v_prospect.city, v_prospect.state, v_prospect.owner_name,
      'Convertido do prospect em ' || to_char(now(),'DD/MM/YYYY HH24:MI'),
      'prospect', v_prospect.id
    ) returning * into v_client;
    v_created := true;
  else
    update public.clients set
      prospect_id  = coalesce(prospect_id, v_prospect.id),
      source_ref   = coalesce(source_ref, v_prospect.id),
      created_from = coalesce(created_from, 'prospect'),
      cnpj         = coalesce(nullif(cnpj,''), nullif(v_prospect.cnpj,'')),
      segment      = coalesce(nullif(segment,''), v_prospect.segment),
      contact_name = coalesce(nullif(contact_name,''), v_prospect.owner_name),
      whatsapp     = coalesce(nullif(whatsapp,''), v_prospect.whatsapp),
      phone        = coalesce(nullif(phone,''), v_prospect.phone),
      email        = coalesce(nullif(email,''), v_prospect.email),
      instagram    = coalesce(nullif(instagram,''), v_prospect.instagram),
      city         = coalesce(nullif(city,''), v_prospect.city),
      state        = coalesce(nullif(state,''), v_prospect.state),
      owner_name   = coalesce(nullif(owner_name,''), v_prospect.owner_name)
    where id = v_client.id
    returning * into v_client;
  end if;

  select * into v_deal from public.deals
    where user_id = v_uid and client_id = v_client.id and closed_at is null
    order by created_at desc limit 1;
  if not found then
    insert into public.deals(
      user_id, client_id, prospect_id, title, value, stage_id, owner_name
    ) values (
      v_uid, v_client.id, v_prospect.id,
      coalesce(p_deal_title, v_prospect.company),
      coalesce(p_deal_value, 0),
      'lead', v_prospect.owner_name
    ) returning * into v_deal;

    insert into public.deal_activities(user_id, deal_id, kind, text)
    values (v_uid, v_deal.id, 'note',
      'Deal criado a partir do prospect ' || v_prospect.company);
  end if;

  update public.prospects
     set status = 'cliente', updated_at = now()
   where id = v_prospect.id;

  insert into public.prospect_interactions(prospect_id, user_id, kind, text, by_name)
  values (v_prospect.id, v_uid, 'nota',
    case when v_created then 'Convertido em cliente' else 'Cliente já existia — vínculo reforçado' end,
    'Sistema');

  return query select v_client.id, v_deal.id, v_created;
end $$;
grant execute on function public.convert_prospect_to_client(uuid, numeric, text) to authenticated;

-- ------------------------------------------------------------
-- 3) Integridade tenant em prospects — backfill defensivo +
-- trigger BEFORE INSERT garantindo organization_id automático.
-- ------------------------------------------------------------
create or replace function public._set_org_from_current()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end $$;

drop trigger if exists prospects_set_org on public.prospects;
create trigger prospects_set_org
  before insert on public.prospects
  for each row execute function public._set_org_from_current();

drop trigger if exists clients_set_org on public.clients;
create trigger clients_set_org
  before insert on public.clients
  for each row execute function public._set_org_from_current();

-- Backfill (idempotente; já rodou em migrations anteriores, mas mantemos
-- para bases que receberam novos registros sem org).
update public.prospects p
   set organization_id = uao.organization_id
  from public.user_active_org uao
 where p.organization_id is null
   and uao.user_id = p.user_id;

update public.prospects p
   set organization_id = o.id
  from public.organizations o
 where p.organization_id is null
   and o.name = 'INFINDA';

update public.clients c
   set organization_id = uao.organization_id
  from public.user_active_org uao
 where c.organization_id is null
   and uao.user_id = c.user_id;

update public.clients c
   set organization_id = o.id
  from public.organizations o
 where c.organization_id is null
   and o.name = 'INFINDA';

do $$
begin
  if not exists (select 1 from public.prospects where organization_id is null limit 1) then
    begin
      alter table public.prospects alter column organization_id set not null;
    exception when others then null;
    end;
  end if;
  if not exists (select 1 from public.clients where organization_id is null limit 1) then
    begin
      alter table public.clients alter column organization_id set not null;
    exception when others then null;
    end;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4) dashboard_metrics() v4 — escopo ÚNICO por org, fail-closed,
-- buckets mutuamente exclusivos, "Responderam" via source_ref.
-- ------------------------------------------------------------
drop function if exists public.dashboard_metrics();

create function public.dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  -- 4.a Auth obrigatória
  if v_uid is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  -- 4.b Organização ativa obrigatória (SEM fallback para user_id)
  select organization_id into v_org
    from public.user_active_org
   where user_id = v_uid;

  if v_org is null then
    raise exception 'no_active_org'
      using errcode = 'P0001',
            hint = 'Selecione uma organização ativa no seletor do header.';
  end if;

  -- 4.c Confirma que o usuário pertence à organização ativa
  if not exists (
    select 1 from public.organization_members
     where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'org_access_denied'
      using errcode = '42501';
  end if;

  return (
  with
  p as (select * from public.prospects where organization_id = v_org),
  c as (select * from public.clients   where organization_id = v_org),
  t_out as (
    select tp.* from public.prospect_touchpoints tp
     join p on p.id = tp.prospect_id
     where tp.tipo in ('whatsapp','ligacao','email','reuniao')
       and tp.resultado <> 'tentativa'
  ),
  t_in as (
    select tp.* from public.prospect_touchpoints tp
     join p on p.id = tp.prospect_id
     where tp.tipo = 'resposta'
        or tp.resultado in ('respondido','interessado')
  ),
  contatados as (select distinct prospect_id from t_out),
  -- Avanços no funil contam como "respondido" SOMENTE via source_ref.
  -- Clientes sem source_ref (criados manualmente) NÃO entram aqui.
  clients_advanced as (
    select distinct source_ref as prospect_id
      from c
     where source_ref is not null
       and pipeline_stage in
         ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
          'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')
  ),
  respondidos as (
    select prospect_id from t_in
    union  -- DISTINCT garantido pela UNION (sem ALL)
    select prospect_id from clients_advanced
  ),
  -- Buckets mutuamente exclusivos. Toda linha de c cai em exatamente um.
  novos          as (select * from c where pipeline_stage in
                      ('PROSPECCAO','CADENCIA','FECHADO')),
  interessados   as (select * from c where pipeline_stage = 'REUNIAO_INICIAL'),
  em_negociacao  as (select * from c where pipeline_stage in
                      ('PROPOSTA','CONTRATO','ASSINATURA',
                       'PAGAMENTO_CONFIRMADO','IMPLANTACAO')),
  ativos         as (select * from c where pipeline_stage = 'ATIVO'),
  perdidos       as (select * from c where pipeline_stage in ('PERDIDO','CHURNED'))
  select jsonb_build_object(
    'schema', 'v4',
    'org_id', v_org,
    'contatos', jsonb_build_object(
      'hoje',   (select count(*) from t_out where enviado_em >= date_trunc('day',   now())),
      'semana', (select count(*) from t_out where enviado_em >= date_trunc('week',  now())),
      'mes',    (select count(*) from t_out where enviado_em >= date_trunc('month', now()))
    ),
    'respostas', jsonb_build_object(
      'hoje',   (select count(*) from t_in where enviado_em >= date_trunc('day',   now())),
      'semana', (select count(*) from t_in where enviado_em >= date_trunc('week',  now())),
      'mes',    (select count(*) from t_in where enviado_em >= date_trunc('month', now())),
      'taxa',   coalesce(round(100.0 * (select count(*) from respondidos)
                                     / nullif((select count(*) from contatados),0), 1), 0)
    ),
    'resumo', jsonb_build_object(
      'base',          (select count(*) from p),
      'contatados',    (select count(*) from contatados),
      'respondidos',   (select count(*) from respondidos),
      'novos',         (select count(*) from novos),
      'interessados',  (select count(*) from interessados),
      'em_negociacao', (select count(*) from em_negociacao),
      'ativos',        (select count(*) from ativos),
      'perdidos',      (select count(*) from perdidos)
    ),
    'pipeline', (
      select coalesce(jsonb_object_agg(pipeline_stage, n), '{}'::jsonb)
      from (select pipeline_stage::text, count(*) as n from c group by pipeline_stage) s
    ),
    'gargalos', jsonb_build_object(
      'cadencia_atrasada',  (select count(*) from p
                              where cadence_status='ativo' and next_contact_at < now()),
      'parados_30d',        (select count(*) from p
                              where last_contact_at < now() - interval '30 days'),
      'sem_responsavel',    (select count(*) from p
                              where coalesce(nullif(owner_name,''), null) is null),
      'clients_parados_15d',(select count(*) from c
                              where updated_at < now() - interval '15 days'
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO')),
      'sem_proxima_acao',   (select count(*) from c
                              where next_action_date is null
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO'))
    ),
    'conversao', jsonb_build_object(
      'base_contato',
        coalesce(round(100.0 * (select count(*) from contatados)
                              / nullif((select count(*) from p),0), 1), 0),
      'contato_resposta',
        coalesce(round(100.0 * (select count(*) from respondidos)
                              / nullif((select count(*) from contatados),0), 1), 0),
      'resposta_interesse',
        coalesce(round(100.0 * ((select count(*) from interessados)
                              + (select count(*) from em_negociacao)
                              + (select count(*) from ativos))
                              / nullif((select count(*) from respondidos),0), 1), 0),
      'interesse_proposta',
        coalesce(round(100.0 * ((select count(*) from em_negociacao)
                              + (select count(*) from ativos))
                              / nullif(((select count(*) from interessados)
                                      + (select count(*) from em_negociacao)
                                      + (select count(*) from ativos)),0), 1), 0),
      'proposta_ativo',
        coalesce(round(100.0 * (select count(*) from ativos)
                              / nullif(((select count(*) from em_negociacao)
                                      + (select count(*) from ativos)),0), 1), 0)
    )
  )
  );
end;
$$;

grant execute on function public.dashboard_metrics() to authenticated;

notify pgrst, 'reload schema';

commit;