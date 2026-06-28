-- ============================================================================
-- Onda 5 — Business Intelligence Layer
-- ----------------------------------------------------------------------------
-- * Tabela ai_insights (cache de análises geradas pela IA por organização)
-- * RPCs BI gerenciais isolados por public.current_org_id()
--   - bi_funnel_bottlenecks()   gargalos do funil
--   - bi_lost_opportunities()   oportunidades perdidas
--   - bi_revenue_forecast()     previsão de receita
--   - bi_churn_risk()           risco de churn
--   - bi_best_contact_hours()   melhores horários de contato
--   - bi_best_channels()        melhores canais
--   - bi_top_campaigns()        campanhas com maior conversão
--   - bi_financial_kpis()       LTV, CAC, ROI, Payback, MRR, ARR,
--                                receita prevista / realizada
--   - bi_dashboard(p_area)      payload consolidado por área
-- ============================================================================

-- ---------- ai_insights ------------------------------------------------------
create table if not exists public.ai_insights (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  area            text not null check (area in ('comercial','financeiro','marketing','operacoes','diretoria')),
  scope           text not null default 'geral',
  payload         jsonb not null default '{}'::jsonb,   -- snapshot de dados de entrada
  summary         text not null,
  recommendations jsonb not null default '[]'::jsonb,   -- array de strings
  model           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

grant select, insert, update, delete on public.ai_insights to authenticated;
grant all on public.ai_insights to service_role;

alter table public.ai_insights enable row level security;

drop policy if exists "ai_insights org rw" on public.ai_insights;
create policy "ai_insights org rw" on public.ai_insights
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create index if not exists ai_insights_org_area_idx
  on public.ai_insights(organization_id, area, created_at desc);

-- ---------- helpers ----------------------------------------------------------
create or replace function public._bi_org() returns uuid
language sql stable security definer set search_path = public as $$
  select public.current_org_id()
$$;

-- ---------- 1) Gargalos do funil --------------------------------------------
create or replace function public.bi_funnel_bottlenecks()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.tempo_medio_dias desc), '[]'::jsonb)
    into v_out
  from (
    select
      coalesce(c.pipeline_stage::text, 'desconhecido') as stage,
      count(*)::int                                    as clientes,
      round(avg(extract(epoch from (now() - c.updated_at)) / 86400)::numeric, 1) as tempo_medio_dias
    from public.clients c
    where c.organization_id = v_org
    group by 1
    having count(*) > 0
  ) t;
  return v_out;
end $$;

-- ---------- 2) Oportunidades perdidas ---------------------------------------
create or replace function public.bi_lost_opportunities()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return jsonb_build_object('total',0,'valor_perdido',0,'recentes','[]'::jsonb); end if;
  select jsonb_build_object(
    'total', (select count(*) from public.clients
              where organization_id = v_org and pipeline_stage::text = 'perdido'),
    'valor_perdido', coalesce((select sum(coalesce(contract_value,0)) from public.clients
              where organization_id = v_org and pipeline_stage::text = 'perdido'), 0),
    'recentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'empresa', coalesce(empresa, company),
        'valor', coalesce(contract_value,0), 'updated_at', updated_at
      ) order by updated_at desc)
      from (
        select id, empresa, company, contract_value, updated_at
          from public.clients
         where organization_id = v_org and pipeline_stage::text = 'perdido'
         order by updated_at desc limit 10
      ) s
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- ---------- 3) Previsão de receita ------------------------------------------
create or replace function public.bi_revenue_forecast()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public._bi_org();
  v_pipeline numeric := 0;
  v_taxa numeric := 0;
  v_ativos numeric := 0;
  v_mrr numeric := 0;
  v_total int := 0;
  v_ganhos int := 0;
begin
  if v_org is null then return jsonb_build_object('previsao_30d',0,'previsao_90d',0,'mrr',0); end if;

  select coalesce(sum(coalesce(contract_value,0)),0)
    into v_pipeline
   from public.clients
   where organization_id = v_org
     and pipeline_stage::text in ('negociacao','proposta','contrato');

  select coalesce(sum(coalesce(contract_value,0)),0)
    into v_ativos
   from public.clients
   where organization_id = v_org and pipeline_stage::text = 'ativo';

  select count(*) into v_total from public.clients where organization_id = v_org;
  select count(*) into v_ganhos from public.clients
    where organization_id = v_org and pipeline_stage::text = 'ativo';

  v_taxa := case when v_total > 0 then v_ganhos::numeric / v_total else 0.15 end;
  v_mrr := v_ativos;

  return jsonb_build_object(
    'pipeline_aberto', v_pipeline,
    'taxa_conversao_historica', round(v_taxa * 100, 1),
    'previsao_30d', round(v_pipeline * v_taxa * 0.4, 2),
    'previsao_90d', round(v_pipeline * v_taxa, 2),
    'mrr', round(v_mrr, 2),
    'arr', round(v_mrr * 12, 2)
  );
end $$;

-- ---------- 4) Risco de churn ------------------------------------------------
create or replace function public.bi_churn_risk()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return jsonb_build_object('alto',0,'medio',0,'baixo',0,'detalhes','[]'::jsonb); end if;

  with base as (
    select c.id, coalesce(c.empresa, c.company) as empresa,
           coalesce(c.contract_value,0) as valor,
           c.updated_at,
           extract(epoch from (now() - c.updated_at)) / 86400 as dias_sem_update
      from public.clients c
     where c.organization_id = v_org
       and c.pipeline_stage::text = 'ativo'
  ), scored as (
    select *,
      case when dias_sem_update > 60 then 'alto'
           when dias_sem_update > 30 then 'medio'
           else 'baixo' end as risco
      from base
  )
  select jsonb_build_object(
    'alto',  (select count(*) from scored where risco='alto'),
    'medio', (select count(*) from scored where risco='medio'),
    'baixo', (select count(*) from scored where risco='baixo'),
    'detalhes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,'empresa',empresa,'valor',valor,
        'dias_sem_update', round(dias_sem_update::numeric,0),
        'risco', risco
      ) order by dias_sem_update desc)
      from (select * from scored where risco in ('alto','medio') order by dias_sem_update desc limit 20) s
    ), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;

-- ---------- 5) Melhores horários --------------------------------------------
create or replace function public.bi_best_contact_hours()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.hora), '[]'::jsonb) into v_out
    from (
      select extract(hour from pt.enviado_em)::int as hora,
             count(*)::int as enviados,
             count(*) filter (where pt.resultado in ('respondido','interessado'))::int as respondidos,
             round(100.0 * count(*) filter (where pt.resultado in ('respondido','interessado'))::numeric
                   / nullif(count(*),0), 1) as taxa_resposta
        from public.prospect_touchpoints pt
        join public.prospects p on p.id = pt.prospect_id
       where p.organization_id = v_org
         and pt.enviado_em > now() - interval '90 days'
       group by 1
    ) t;
  return v_out;
end $$;

-- ---------- 6) Melhores canais ----------------------------------------------
create or replace function public.bi_best_channels()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(row_to_json(t) order by t.taxa_resposta desc nulls last), '[]'::jsonb) into v_out
    from (
      select pt.tipo as canal,
             count(*)::int as enviados,
             count(*) filter (where pt.resultado in ('respondido','interessado'))::int as respondidos,
             round(100.0 * count(*) filter (where pt.resultado in ('respondido','interessado'))::numeric
                   / nullif(count(*),0), 1) as taxa_resposta
        from public.prospect_touchpoints pt
        join public.prospects p on p.id = pt.prospect_id
       where p.organization_id = v_org
         and pt.enviado_em > now() - interval '90 days'
       group by 1
    ) t;
  return v_out;
end $$;

-- ---------- 7) Top campanhas -------------------------------------------------
create or replace function public.bi_top_campaigns()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid := public._bi_org(); v_out jsonb;
begin
  if v_org is null then return '[]'::jsonb; end if;
  -- Aproximação: usa op_campaigns + clientes ativos do mesmo client_id
  select coalesce(jsonb_agg(row_to_json(t) order by t.receita desc nulls last), '[]'::jsonb) into v_out
    from (
      select k.campaign_name as campanha,
             k.status,
             count(distinct k.client_id)::int as clientes,
             coalesce(sum(coalesce(c.contract_value,0)),0) as receita
        from public.op_campaigns k
        left join public.clients c on c.id = k.client_id and c.organization_id = v_org
       where k.organization_id = v_org
       group by 1,2
       order by receita desc
       limit 15
    ) t;
  return v_out;
end $$;

-- ---------- 8) KPIs financeiros ---------------------------------------------
create or replace function public.bi_financial_kpis()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid := public._bi_org();
  v_clientes_ativos int := 0;
  v_receita_realizada numeric := 0;
  v_mrr numeric := 0;
  v_custo numeric := 0;
  v_ticket numeric := 0;
  v_cac numeric := 0;
  v_ltv numeric := 0;
  v_roi numeric := 0;
  v_payback numeric := 0;
  v_meta numeric := 0;
  v_novos_no_mes int := 0;
begin
  if v_org is null then return jsonb_build_object('ltv',0,'cac',0,'roi',0,'payback_meses',0); end if;

  select count(*), coalesce(sum(coalesce(contract_value,0)),0)
    into v_clientes_ativos, v_mrr
    from public.clients
   where organization_id = v_org and pipeline_stage::text = 'ativo';

  v_receita_realizada := v_mrr;

  select count(*) into v_novos_no_mes
    from public.clients
   where organization_id = v_org
     and created_at >= date_trunc('month', now());

  select coalesce(custo_marketing,0), coalesce(meta_receita,0)
    into v_custo, v_meta
    from public.org_goals
   where organization_id = v_org
   order by year desc nulls last, month desc nulls last
   limit 1;

  v_ticket := case when v_clientes_ativos > 0 then v_mrr / v_clientes_ativos else 0 end;
  v_cac    := case when v_novos_no_mes > 0 then v_custo / v_novos_no_mes else 0 end;
  -- Assumindo retenção média de 12 meses
  v_ltv    := v_ticket * 12;
  v_roi    := case when v_custo > 0 then 100.0 * (v_receita_realizada - v_custo) / v_custo else 0 end;
  v_payback:= case when v_ticket > 0 then v_cac / v_ticket else 0 end;

  return jsonb_build_object(
    'clientes_ativos', v_clientes_ativos,
    'ticket_medio', round(v_ticket, 2),
    'mrr', round(v_mrr, 2),
    'arr', round(v_mrr * 12, 2),
    'receita_realizada', round(v_receita_realizada, 2),
    'receita_prevista_mes', round(v_meta, 2),
    'custo_marketing', round(v_custo, 2),
    'cac', round(v_cac, 2),
    'ltv', round(v_ltv, 2),
    'roi', round(v_roi, 1),
    'payback_meses', round(v_payback, 1)
  );
end $$;

-- ---------- 9) Dashboard consolidado por área -------------------------------
create or replace function public.bi_dashboard(p_area text default 'diretoria')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_out jsonb := '{}'::jsonb;
begin
  case p_area
    when 'comercial' then
      v_out := jsonb_build_object(
        'funnel',        public.bi_funnel_bottlenecks(),
        'lost',          public.bi_lost_opportunities(),
        'best_hours',    public.bi_best_contact_hours(),
        'best_channels', public.bi_best_channels(),
        'forecast',      public.bi_revenue_forecast()
      );
    when 'financeiro' then
      v_out := jsonb_build_object(
        'kpis',          public.bi_financial_kpis(),
        'forecast',      public.bi_revenue_forecast(),
        'lost',          public.bi_lost_opportunities()
      );
    when 'marketing' then
      v_out := jsonb_build_object(
        'top_campaigns', public.bi_top_campaigns(),
        'best_hours',    public.bi_best_contact_hours(),
        'best_channels', public.bi_best_channels(),
        'kpis',          public.bi_financial_kpis()
      );
    when 'operacoes' then
      v_out := jsonb_build_object(
        'churn',         public.bi_churn_risk(),
        'top_campaigns', public.bi_top_campaigns(),
        'funnel',        public.bi_funnel_bottlenecks()
      );
    else -- diretoria
      v_out := jsonb_build_object(
        'kpis',          public.bi_financial_kpis(),
        'forecast',      public.bi_revenue_forecast(),
        'funnel',        public.bi_funnel_bottlenecks(),
        'churn',         public.bi_churn_risk(),
        'lost',          public.bi_lost_opportunities(),
        'top_campaigns', public.bi_top_campaigns()
      );
  end case;
  return v_out;
end $$;

grant execute on function public.bi_funnel_bottlenecks(),
                          public.bi_lost_opportunities(),
                          public.bi_revenue_forecast(),
                          public.bi_churn_risk(),
                          public.bi_best_contact_hours(),
                          public.bi_best_channels(),
                          public.bi_top_campaigns(),
                          public.bi_financial_kpis(),
                          public.bi_dashboard(text)
  to authenticated;

notify pgrst, 'reload schema';