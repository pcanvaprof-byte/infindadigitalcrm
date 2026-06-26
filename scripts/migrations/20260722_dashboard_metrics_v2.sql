-- ============================================================
-- Dashboard v2 — fonte única
--   Contatos / Respostas → prospect_touchpoints
--   Pipeline (interessados, negociação, fechados, gargalos) → clients (Lifecycle)
--   Remove dependência de: resultado='tentativa', prospects.response_status, deals
-- ============================================================

begin;

-- 1) Expande CHECK de tipo para aceitar 'resposta' (touchpoint inbound) ----
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.prospect_touchpoints'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo%'
  loop
    execute format('alter table public.prospect_touchpoints drop constraint if exists %I', r.conname);
  end loop;

  alter table public.prospect_touchpoints
    add constraint prospect_touchpoints_tipo_check
    check (tipo in ('whatsapp','ligacao','email','reuniao','nota','status','resposta'));
end $$;

-- 2) Trigger de cadência: 'resposta' não avança step, mas registra resposta
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
  -- nota / status / resposta inbound não fazem avançar a cadência
  if new.tipo in ('nota','status','resposta') then
    if new.tipo = 'resposta' then
      update prospects
         set response_status = coalesce(nullif(response_status,'sem_resposta'), 'respondeu'),
             updated_at = now()
       where id = new.prospect_id;
    end if;
    return new;
  end if;

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
    when 'respondido'    then 'respondeu'
    when 'interessado'   then 'interessado'
    when 'sem_interesse' then 'sem_interesse'
    else null end;

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

-- 3) RPC dashboard_metrics v2 ---------------------------------------------
create or replace function public.dashboard_metrics()
returns jsonb language sql stable security definer set search_path = public as $$
  with
  p as (select * from prospects where user_id = auth.uid()),
  -- Contatos = envios reais (whatsapp/ligação/email/reunião) — sem 'tentativa', sem nota/status/resposta
  t_out as (
    select * from prospect_touchpoints
     where user_id = auth.uid()
       and tipo in ('whatsapp','ligacao','email','reuniao')
       and resultado <> 'tentativa'
  ),
  -- Respostas = touchpoints inbound OU touchpoints marcados como respondidos
  t_in as (
    select * from prospect_touchpoints
     where user_id = auth.uid()
       and (tipo = 'resposta' or resultado in ('respondido','interessado'))
  ),
  contatados as (select distinct prospect_id from t_out),
  respondidos as (select distinct prospect_id from t_in),
  c as (
    select * from clients
     where user_id = auth.uid()
        or organization_id = public.current_org_id()
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
      'interessados',  (select count(*) from c where pipeline_stage in
                          ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
                           'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),
      'em_negociacao', (select count(*) from c where pipeline_stage in
                          ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO')),
      'ativos',        (select count(*) from c where pipeline_stage = 'ATIVO'),
      'perdidos',      (select count(*) from c where pipeline_stage in ('PERDIDO','CHURNED'))
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
        coalesce(round(100.0 * (select count(*) from c where pipeline_stage in
                                  ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
                                   'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO'))
                              / nullif((select count(*) from respondidos),0), 1), 0),
      'interesse_proposta',
        coalesce(round(100.0 * (select count(*) from c where pipeline_stage in
                                  ('PROPOSTA','CONTRATO','ASSINATURA',
                                   'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO'))
                              / nullif((select count(*) from c where pipeline_stage in
                                  ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA',
                                   'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),0), 1), 0),
      'proposta_ativo',
        coalesce(round(100.0 * (select count(*) from c where pipeline_stage = 'ATIVO')
                              / nullif((select count(*) from c where pipeline_stage in
                                  ('PROPOSTA','CONTRATO','ASSINATURA',
                                   'PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),0), 1), 0)
    )
  );
$$;

grant execute on function public.dashboard_metrics() to authenticated;

commit;