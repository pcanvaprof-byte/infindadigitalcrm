-- ============================================================
-- Dashboard v3 — escopo por organização + KPIs mutuamente exclusivos
--
-- Mudanças vs v2 (20260722):
--  1) Escopo unificado por organization_id = current_org_id()
--     (fallback para user_id quando a org ainda não existir no banco).
--  2) "Responderam" passa a contar também leads que avançaram no funil
--     (clients em REUNIAO_INICIAL+) como proxy real de resposta, além
--     do touchpoint inbound (tipo='resposta' / resultado respondido|interessado).
--  3) "Interessados" agora exclui ATIVO (e também exclui em_negociacao,
--     para ser mutuamente exclusivo).
--  4) Padroniza os 3 buckets do funil (mutuamente exclusivos):
--       interessados  = REUNIAO_INICIAL
--       em_negociacao = PROPOSTA, CONTRATO, ASSINATURA, PAGAMENTO_CONFIRMADO, IMPLANTACAO
--       ativos        = ATIVO
-- ============================================================

begin;

set local check_function_bodies = off;

create or replace function public.dashboard_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
begin
  return (
  with
  -- Escopo por organização quando disponível; senão cai para user_id
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
  -- Responderam: touchpoint inbound OU client que avançou no funil
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
  -- Buckets mutuamente exclusivos
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

commit;