
CREATE OR REPLACE FUNCTION public.dashboard_metrics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return (
  with
  p as (select * from prospects where user_id = auth.uid()),
  t_out as (
    select * from prospect_touchpoints
     where user_id = auth.uid()
       and tipo in ('whatsapp','ligacao','email','reuniao')
       and resultado <> 'tentativa'
  ),
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
        or (public.current_org_role() in ('owner','admin')
            and organization_id = public.dashboard_current_org_id())
  )
  select jsonb_build_object(
    'contatos', jsonb_build_object(
      'hoje', (select count(*) from t_out where enviado_em >= date_trunc('day', now())),
      'semana', (select count(*) from t_out where enviado_em >= date_trunc('week', now())),
      'ultimos_7d', (select count(*) from t_out where enviado_em >= now() - interval '7 days'),
      'mes', (select count(*) from t_out where enviado_em >= date_trunc('month', now()))
    ),
    'respostas', jsonb_build_object(
      'hoje', (select count(*) from t_in where enviado_em >= date_trunc('day', now())),
      'semana', (select count(*) from t_in where enviado_em >= date_trunc('week', now())),
      'ultimos_7d', (select count(*) from t_in where enviado_em >= now() - interval '7 days'),
      'mes', (select count(*) from t_in where enviado_em >= date_trunc('month', now())),
      'taxa', coalesce(round(100.0 * (select count(*) from respondidos) / nullif((select count(*) from contatados),0), 1), 0)
    ),
    'resumo', jsonb_build_object(
      'base', (select count(*) from p),
      'contatados', (select count(*) from contatados),
      'respondidos', (select count(*) from respondidos),
      'novos', (select count(*) from p where coalesce(nullif(status,''), 'novo') in ('novo','nao_contatado','primeiro_contato')),
      'interessados', (select count(*) from c where pipeline_stage in
        ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),
      'em_negociacao', (select count(*) from c where pipeline_stage in
        ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO')),
      'ativos', (select count(*) from c where pipeline_stage = 'ATIVO'),
      'perdidos', (select count(*) from c where pipeline_stage in ('PERDIDO','CHURNED'))
    ),
    'pipeline', (
      select coalesce(jsonb_object_agg(pipeline_stage, n), '{}'::jsonb)
      from (select pipeline_stage::text, count(*) as n from c group by pipeline_stage) s
    ),
    'gargalos', jsonb_build_object(
      'cadencia_atrasada', (select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'parados_30d', (select count(*) from p
                        where last_contact_at < now() - interval '30 days'
                          and coalesce(status,'') not in ('perdido','cliente','fechado_ganho','entregue')),
      'sem_responsavel', (select count(*) from p where coalesce(nullif(owner_name,''), null) is null),
      'clients_parados_15d', (select count(*) from c where updated_at < now() - interval '15 days'
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO')),
      'sem_proxima_acao', (select count(*) from c where next_action_date is null
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO'))
    ),
    'conversao', jsonb_build_object(
      'base_contato', coalesce(round(100.0 * (select count(*) from contatados) / nullif((select count(*) from p),0), 1), 0),
      'contato_resposta', coalesce(round(100.0 * (select count(*) from respondidos) / nullif((select count(*) from contatados),0), 1), 0),
      'resposta_interesse', coalesce(round(100.0 * (select count(*) from c where pipeline_stage in
          ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO'))
        / nullif((select count(*) from respondidos),0), 1), 0),
      'interesse_proposta', coalesce(round(100.0 * (select count(*) from c where pipeline_stage in
          ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO'))
        / nullif((select count(*) from c where pipeline_stage in
          ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),0), 1), 0),
      'proposta_ativo', coalesce(round(100.0 * (select count(*) from c where pipeline_stage = 'ATIVO')
        / nullif((select count(*) from c where pipeline_stage in
          ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO')),0), 1), 0)
    )
  ));
end
$function$;
