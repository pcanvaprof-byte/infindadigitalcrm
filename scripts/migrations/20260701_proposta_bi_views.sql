-- ============================================================
-- INFINDA — Propostas Fase 6: BI Views (verdade única)
--
-- Regras EBD (docs/architecture/event-boundaries.md):
--  * Toda view consome SOMENTE proposal_events (evt_*) + tabelas de
--    domínio (proposals, proposal_items, proposal_item_decisions,
--    proposal_loss_reasons, financeiro_previsto, proposal_views).
--  * NENHUMA view de BI faz JOIN/SELECT em audit_logs — bloqueado pelo
--    linter scripts/lint-ebd.mjs (EBD-2).
--  * Frontend NUNCA recalcula KPIs — lê direto das vw_*.
-- ============================================================

-- security_invoker=on garante que RLS das tabelas-base seja aplicada
-- com a identidade do leitor (o usuário autenticado), não do owner.

-- ----------------------------------------------------------------
-- 1) vw_proposal_kpis — KPIs agregados por usuário
-- ----------------------------------------------------------------
drop view if exists public.vw_proposal_kpis;
create view public.vw_proposal_kpis
with (security_invoker = on) as
select
  p.user_id,
  count(*)::int                                                   as total,
  count(*) filter (where p.status = 'rascunho')::int              as rascunho,
  count(*) filter (where p.status in (
    'enviada','visualizada','ajustes_solicitados','aprovada',
    'rejeitada','expirada','convertida'
  ))::int                                                         as enviadas,
  count(*) filter (where p.first_viewed_at is not null)::int      as visualizadas,
  count(*) filter (where p.status in ('aprovada','convertida'))::int as aprovadas,
  count(*) filter (where p.status = 'rejeitada')::int             as rejeitadas,
  count(*) filter (where p.status = 'expirada')::int              as expiradas,
  coalesce(sum(p.valor_implantacao + p.valor_mensal * 12) filter (
    where p.status in (
      'enviada','visualizada','ajustes_solicitados','aprovada',
      'rejeitada','expirada','convertida'
    )
  ), 0)::numeric                                                  as valor_total_enviado,
  coalesce(sum(p.valor_implantacao + p.valor_mensal * 12) filter (
    where p.status in ('aprovada','convertida')
  ), 0)::numeric                                                  as valor_total_aprovado,
  coalesce(sum(p.valor_implantacao + p.valor_mensal * 12) filter (
    where p.status in ('rejeitada','expirada')
  ), 0)::numeric                                                  as valor_perdido,
  case
    when count(*) filter (where p.status in ('aprovada','convertida')) > 0
    then sum(p.valor_implantacao + p.valor_mensal * 12) filter (
      where p.status in ('aprovada','convertida')
    ) / count(*) filter (where p.status in ('aprovada','convertida'))
    else 0
  end::numeric                                                    as ticket_medio,
  case
    when count(*) filter (where p.status in (
      'enviada','visualizada','ajustes_solicitados','aprovada',
      'rejeitada','expirada','convertida'
    )) > 0
    then 100.0 * count(*) filter (where p.status in ('aprovada','convertida'))
         / count(*) filter (where p.status in (
           'enviada','visualizada','ajustes_solicitados','aprovada',
           'rejeitada','expirada','convertida'
         ))
    else 0
  end::numeric                                                    as taxa_aprovacao
from public.proposals p
group by p.user_id;

grant select on public.vw_proposal_kpis to authenticated;

-- ----------------------------------------------------------------
-- 2) vw_proposal_conversion — tempos médios derivados de eventos
--    Usa proposal_events (evt_*) como fonte de verdade temporal.
-- ----------------------------------------------------------------
drop view if exists public.vw_proposal_conversion;
create view public.vw_proposal_conversion
with (security_invoker = on) as
with eventos as (
  select
    e.proposal_id,
    min(e.created_at) filter (where e.tipo = 'evt_proposal_sent')      as sent_at,
    min(e.created_at) filter (where e.tipo = 'evt_proposal_viewed')    as first_view_at,
    min(e.created_at) filter (where e.tipo in (
      'evt_proposal_approved','evt_proposal_rejected','evt_adjustments_requested'
    ))                                                                  as decided_at
  from public.proposal_events e
  group by e.proposal_id
)
select
  p.user_id,
  count(*) filter (where e.sent_at is not null)::int                                as enviadas,
  count(*) filter (where e.first_view_at is not null)::int                          as visualizadas,
  count(*) filter (where e.decided_at is not null)::int                             as decididas,
  coalesce(avg(extract(epoch from (e.first_view_at - e.sent_at)) / 3600.0) filter (
    where e.first_view_at is not null and e.sent_at is not null
  ), 0)::numeric                                                                    as tempo_medio_visualizacao_h,
  coalesce(avg(extract(epoch from (e.decided_at - e.sent_at)) / 3600.0) filter (
    where e.decided_at is not null and e.sent_at is not null
  ), 0)::numeric                                                                    as tempo_medio_decisao_h
from public.proposals p
left join eventos e on e.proposal_id = p.id
group by p.user_id;

grant select on public.vw_proposal_conversion to authenticated;

-- ----------------------------------------------------------------
-- 3) vw_proposal_funnel_full — funil de propostas por status
-- ----------------------------------------------------------------
drop view if exists public.vw_proposal_funnel_full;
create view public.vw_proposal_funnel_full
with (security_invoker = on) as
select
  p.user_id,
  p.status,
  count(*)::int                                                   as total,
  coalesce(sum(p.valor_implantacao + p.valor_mensal * 12), 0)::numeric as valor_total
from public.proposals p
group by p.user_id, p.status;

grant select on public.vw_proposal_funnel_full to authenticated;

-- ----------------------------------------------------------------
-- 4) vw_proposal_timeline — timeline reproduzível por proposta
--    Cada linha é um evento de negócio. Ordenado ascendente.
--    Sem audit_logs (EBD-2). Sem gaps silenciosos.
-- ----------------------------------------------------------------
drop view if exists public.vw_proposal_timeline;
create view public.vw_proposal_timeline
with (security_invoker = on) as
select
  e.id,
  e.proposal_id,
  e.tipo                                                          as event_type,
  e.actor_type,
  e.actor_id,
  e.payload,
  e.created_at
from public.proposal_events e;

grant select on public.vw_proposal_timeline to authenticated;

-- ----------------------------------------------------------------
-- 5) vw_proposal_revenue_forecast — receita prevista por snapshot
--    Lê da tabela imutável financeiro_previsto, da versão ATIVA.
-- ----------------------------------------------------------------
drop view if exists public.vw_proposal_revenue_forecast;
create view public.vw_proposal_revenue_forecast
with (security_invoker = on) as
select
  p.user_id,
  fp.tipo,
  date_trunc('month', fp.competencia)::date                       as competencia_mes,
  count(distinct fp.proposal_id)::int                             as propostas,
  coalesce(sum(fp.valor), 0)::numeric                             as valor
from public.financeiro_previsto fp
join public.proposals p              on p.id = fp.proposal_id
join public.proposal_versions pv     on pv.id = fp.proposal_version_id
where pv.is_active = true
group by p.user_id, fp.tipo, date_trunc('month', fp.competencia);

grant select on public.vw_proposal_revenue_forecast to authenticated;

notify pgrst, 'reload schema';