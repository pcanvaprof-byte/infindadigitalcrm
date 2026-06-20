-- ============================================================
-- FASE 6.1: Tracking duplo de interações (tentativa + enviado)
-- - Adiciona 'tentativa' no check de resultado
-- - Trigger ignora 'tentativa' (não avança cadência)
-- - dashboard_metrics: KPIs de contato passam a contar apenas
--   resultados confirmados (não 'tentativa'); novo bloco
--   "tentativas" com hoje/semana/mes.
-- Sem breaking change para UI ou tipos existentes.
-- ============================================================

-- 1) Recriar check de resultado incluindo 'tentativa' --------------------
alter table public.prospect_touchpoints
  drop constraint if exists prospect_touchpoints_resultado_check;

alter table public.prospect_touchpoints
  add constraint prospect_touchpoints_resultado_check
  check (resultado in ('tentativa','enviado','respondido','interessado','sem_interesse','sem_resposta'));

-- 2) Trigger: tentativa NÃO avança cadência ------------------------------
create or replace function public.advance_prospect_cadence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  intervals int[] := array[1,3,7,15,21];
  cur_step smallint;
  nxt_step smallint;
  nxt_at   timestamptz;
  new_resp text;
  new_cad  text;
begin
  -- tentativa de contato (clique) e nota não avançam cadência
  if new.resultado = 'tentativa' or new.tipo = 'nota' then
    return new;
  end if;

  select cadence_step into cur_step from prospects where id = new.prospect_id;
  nxt_step := least(coalesce(cur_step,0) + 1, 6);

  if new.resultado = 'sem_interesse' or nxt_step >= 6 then
    nxt_at := null;
    new_cad := 'encerrado';
  elsif new.resultado = 'interessado' then
    nxt_at := null;
    new_cad := 'ativo';
  else
    nxt_at := new.enviado_em + (intervals[nxt_step] || ' days')::interval;
    new_cad := 'ativo';
  end if;

  new_resp := case new.resultado
    when 'respondido'    then 'respondeu'
    when 'interessado'   then 'interessado'
    when 'sem_interesse' then 'sem_interesse'
    else null
  end;

  update prospects set
    cadence_step    = nxt_step,
    cadence_status  = new_cad,
    last_contact_at = new.enviado_em,
    next_contact_at = nxt_at,
    response_status = coalesce(new_resp, response_status),
    closed_at       = case when new_cad = 'encerrado' then now() else closed_at end,
    closed_reason   = case when new.resultado = 'sem_interesse' then 'sem_interesse'
                           when nxt_step >= 6 then 'cadencia_concluida'
                           else closed_reason end,
    updated_at      = now()
  where id = new.prospect_id;

  return new;
end $$;

-- 3) RPC dashboard_metrics: separa tentativas de envios confirmados ------
create or replace function public.dashboard_metrics()
returns jsonb language sql stable security definer set search_path = public as $$
  with
  p as (select * from prospects where user_id = auth.uid()),
  t_all as (select * from prospect_touchpoints where user_id = auth.uid()),
  t as (select * from t_all where resultado <> 'tentativa'),
  ttry as (select * from t_all where resultado = 'tentativa'),
  d as (
    select d.*, s.is_won, s.is_lost, s.is_meeting, s.is_proposal
    from deals d
    left join deal_stages s on s.id = d.stage_id
    where d.user_id = auth.uid()
  )
  select jsonb_build_object(
    'operacao', jsonb_build_object(
      'base',         (select count(*) from p),
      'contatadas',   (select count(*) from p where last_contact_at is not null),
      'sem_resposta', (select count(*) from p where response_status = 'sem_resposta' and last_contact_at is not null),
      'interessadas', (select count(*) from p where response_status in ('interessado','cliente')),
      'clientes',     (select count(*) from p where response_status = 'cliente')
    ),
    'cadencia', jsonb_build_object(
      'hoje',   (select count(*) from t where enviado_em >= date_trunc('day',   now())),
      'semana', (select count(*) from t where enviado_em >= date_trunc('week',  now())),
      'mes',    (select count(*) from t where enviado_em >= date_trunc('month', now())),
      'taxa_resposta',   coalesce((select round(100.0 * count(*) filter (where response_status <> 'sem_resposta')
                                                 / nullif(count(*),0), 1)
                                    from p where last_contact_at is not null), 0),
      'taxa_interesse',  coalesce((select round(100.0 * count(*) filter (where response_status in ('interessado','cliente'))
                                                 / nullif(count(*),0), 1)
                                    from p where last_contact_at is not null), 0),
      'taxa_fechamento', coalesce((select round(100.0 * count(*) filter (where response_status = 'cliente')
                                                 / nullif(count(*),0), 1)
                                    from p), 0)
    ),
    'tentativas', jsonb_build_object(
      'hoje',   (select count(*) from ttry where enviado_em >= date_trunc('day',   now())),
      'semana', (select count(*) from ttry where enviado_em >= date_trunc('week',  now())),
      'mes',    (select count(*) from ttry where enviado_em >= date_trunc('month', now()))
    ),
    'gargalos', jsonb_build_object(
      'atrasados',         (select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'parados_30d',       (select count(*) from p where last_contact_at < now() - interval '30 days'),
      'sem_responsavel',   (select count(*) from p where coalesce(nullif(owner_name,''), null) is null),
      'deals_paradas_15d', (select count(*) from d where updated_at < now() - interval '15 days'
                                                      and coalesce(is_won,false) = false
                                                      and coalesce(is_lost,false) = false)
    ),
    'conversao', jsonb_build_object(
      'base_contato',
        coalesce((select round(100.0*count(*) filter (where last_contact_at is not null)
                              / nullif(count(*),0),1) from p), 0),
      'contato_interesse',
        coalesce((select round(100.0*count(*) filter (where response_status in ('interessado','cliente'))
                              / nullif(count(*),0),1) from p where last_contact_at is not null), 0),
      'interesse_reuniao',
        coalesce((select round(100.0*count(*) filter (where is_meeting = true)
                              / nullif(count(*),0),1) from d), 0),
      'reuniao_proposta',
        coalesce((select round(100.0*count(*) filter (where is_proposal = true)
                              / nullif(count(*) filter (where is_meeting = true),0),1) from d), 0),
      'proposta_cliente',
        coalesce((select round(100.0*count(*) filter (where coalesce(is_won,false) = true)
                              / nullif(count(*) filter (where is_proposal = true),0),1) from d), 0)
    ),
    'filtros', jsonb_build_object(
      'hoje',         (select count(*) from p where cadence_status='ativo' and next_contact_at::date = current_date),
      'atrasados',    (select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'sem_resposta', (select count(*) from p where response_status='sem_resposta' and last_contact_at is not null),
      'responderam',  (select count(*) from p where response_status in ('respondeu','interessado','cliente')),
      'interessados', (select count(*) from p where response_status='interessado'),
      'clientes',     (select count(*) from p where response_status='cliente')
    )
  );
$$;

grant execute on function public.dashboard_metrics() to authenticated;
