-- ============================================================
-- Hotfix Dashboard zerado — prospects sem organization_id
--
-- Causa: a RPC dashboard_metrics() v3 filtra prospects.organization_id,
-- mas em algumas bases a tabela public.prospects não recebeu essa coluna
-- na primeira onda multi-tenant. Resultado: RPC falha com 42703 e o
-- frontend cai para métricas vazias.
--
-- Estratégia: ADITIVA. Não apaga dados, não reseta banco.
-- 1) Adiciona organization_id em prospects.
-- 2) Backfill por user_active_org; fallback para a org INFINDA.
-- 3) Reaplica isolamento tenant em prospects.
-- 4) Recria dashboard_metrics() v3 e força reload do cache da API.
-- ============================================================

begin;

set local check_function_bodies = off;

-- 1) Garantir coluna tenant em prospects ---------------------
do $$
begin
  if to_regclass('public.prospects') is null then
    raise exception 'public.prospects não existe — dashboard_metrics depende dela';
  end if;

  if to_regclass('public.organizations') is not null then
    alter table public.prospects
      add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
  else
    alter table public.prospects
      add column if not exists organization_id uuid;
  end if;
end $$;

-- 2) Backfill seguro: usa a org ativa do dono do prospect; se faltar,
-- usa a organização padrão INFINDA.
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

-- Default para novos inserts legados.
alter table public.prospects
  alter column organization_id set default public.current_org_id();

-- Só endurece NOT NULL quando o backfill conseguiu cobrir tudo.
do $$
begin
  if exists (select 1 from public.prospects where organization_id is null limit 1) then
    raise notice 'prospects.organization_id ainda possui NULLs; mantendo nullable para não quebrar dados antigos';
  else
    alter table public.prospects alter column organization_id set not null;
  end if;
end $$;

create index if not exists idx_prospects_org on public.prospects(organization_id);
create index if not exists idx_prospects_org_user on public.prospects(organization_id, user_id);

alter table public.prospects enable row level security;

-- Mantém compatibilidade com policies antigas por usuário, adicionando a
-- camada restritiva por organização quando a org ativa existe.
drop policy if exists tenant_isolation_restrictive on public.prospects;
create policy tenant_isolation_restrictive on public.prospects
  as restrictive
  for all to authenticated
  using (
    public.current_org_id() is null
    or organization_id = public.current_org_id()
  )
  with check (
    public.current_org_id() is null
    or organization_id = public.current_org_id()
  );

-- 3) Recriar helper defensivo --------------------------------
create or replace function public.dashboard_current_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if to_regprocedure('public.current_org_id()') is null then
    return null;
  end if;

  execute 'select public.current_org_id()' into v_org;
  return v_org;
exception when others then
  return null;
end $$;

grant execute on function public.dashboard_current_org_id() to authenticated, anon, service_role;

-- 4) Recriar dashboard_metrics() v3 --------------------------
drop function if exists public.dashboard_metrics();

create function public.dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.dashboard_current_org_id();
begin
  return (
  with
  p as (
    select * from prospects
     where (v_org is not null and organization_id = v_org)
        or (v_org is null and user_id = auth.uid())
  ),
  c as (
    select * from clients
     where (v_org is not null and organization_id = v_org)
        or (v_org is null and user_id = auth.uid())
  ),
  t_out as (
    select tp.* from prospect_touchpoints tp
     join p on p.id = tp.prospect_id
     where tp.tipo in ('whatsapp','ligacao','email','reuniao')
       and tp.resultado <> 'tentativa'
  ),
  t_in as (
    select tp.* from prospect_touchpoints tp
     join p on p.id = tp.prospect_id
     where tp.tipo = 'resposta'
        or tp.resultado in ('respondido','interessado')
  ),
  contatados as (select distinct prospect_id from t_out),
  respondidos_tp as (select distinct prospect_id from t_in),
  clients_advanced as (
    select distinct coalesce(source_ref, id) as ref_id
      from c
     where pipeline_stage in
       ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
        'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')
  ),
  respondidos as (
    select prospect_id as ref_id from respondidos_tp
    union
    select ref_id from clients_advanced
  ),
  interessados as (
    select * from c where pipeline_stage = 'REUNIAO_INICIAL'
  ),
  em_negociacao as (
    select * from c where pipeline_stage in
      ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO')
  ),
  ativos as (
    select * from c where pipeline_stage = 'ATIVO'
  ),
  perdidos as (
    select * from c where pipeline_stage in ('PERDIDO','CHURNED')
  )
  select jsonb_build_object(
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
      'interessados',  (select count(*) from interessados),
      'em_negociacao', (select count(*) from em_negociacao),
      'ativos',        (select count(*) from ativos),
      'perdidos',      (select count(*) from perdidos)
    ),
    'pipeline', (
      select coalesce(jsonb_object_agg(pipeline_stage, n), '{}'::jsonb)
      from (
        select pipeline_stage::text, count(*) as n
        from c group by pipeline_stage
      ) s
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