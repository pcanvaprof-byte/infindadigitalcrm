
CREATE OR REPLACE FUNCTION public.dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_is_admin boolean := (public.current_org_role() in ('owner','admin'));
        v_org uuid := public.dashboard_current_org_id();
begin
  return (
  with
  -- Prospects (cadastro compartilhado da org). Base = todos os leads visíveis
  -- na organização; membros comuns e admins veem o mesmo cadastro.
  p as (
    select * from prospects
     where organization_id = v_org
  ),
  -- Estado operacional privado por usuário (para gargalos de cadência).
  uls as (
    select * from user_lead_state
     where v_is_admin or user_id = auth.uid()
  ),
  -- Touchpoints: escopo por usuário; admins/owners veem toda a organização.
  t_out as (
    select * from prospect_touchpoints
     where organization_id = v_org
       and (v_is_admin or user_id = auth.uid())
       and tipo in ('whatsapp','ligacao','email','reuniao')
       and resultado <> 'tentativa'
  ),
  t_in as (
    select * from prospect_touchpoints
     where organization_id = v_org
       and (v_is_admin or user_id = auth.uid())
       and (tipo = 'resposta' or resultado in ('respondido','interessado'))
  ),
  contatados as (select distinct prospect_id from t_out),
  respondidos as (select distinct prospect_id from t_in),
  -- Clients (CRM/pipeline privado). RLS já filtra, mas reforçamos aqui.
  c as (
    select * from clients
     where organization_id = v_org
       and (v_is_admin or user_id = auth.uid())
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
      -- Base = universo compartilhado (empresas cadastradas na org).
      'base', (select count(*) from p),
      -- Demais métricas são privadas por usuário (via t_out/t_in/c).
      'contatados', (select count(*) from contatados),
      'respondidos', (select count(*) from respondidos),
      'novos', (select count(*) from c where pipeline_stage in ('PROSPECCAO','CADENCIA','FECHADO')),
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
      'cadencia_atrasada', (select count(*) from uls where cadence_status='ativo' and next_contact_at < now()),
      'parados_30d', (select count(*) from uls
                        where last_contact_at < now() - interval '30 days'
                          and coalesce(cadence_status,'') not in ('encerrado')),
      'sem_responsavel', (select count(*) from p where coalesce(nullif(owner_name,''), null) is null),
      'clients_parados_15d', (select count(*) from c where updated_at < now() - interval '15 days'
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO')),
      'sem_proxima_acao', (select count(*) from c where next_action_date is null
                                and pipeline_stage not in ('ATIVO','CHURNED','PERDIDO'))
    ),
    'conversao', jsonb_build_object(
      'base_contato', coalesce(round(100.0 * (select count(*) from contatados) / nullif((select count(*) from p),0), 1), 0),
      'contato_resposta', coalesce(round(100.0 * (select count(*) from respondidos) / nullif((select count(*) from contatados),0), 1), 0),
      'resposta_interesse', coalesce(round(100.0 * (select count(*) from c where pipeline_stage in ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')) / nullif((select count(*) from respondidos),0), 1), 0),
      'interesse_proposta', coalesce(round(100.0 * (select count(*) from c where pipeline_stage in ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','ATIVO')) / nullif((select count(*) from c where pipeline_stage in ('REUNIAO_INICIAL','PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO','ATIVO')),0), 1), 0),
      'proposta_ativo', coalesce(round(100.0 * (select count(*) from c where pipeline_stage = 'ATIVO') / nullif((select count(*) from c where pipeline_stage in ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','ATIVO')),0), 1), 0)
    ),
    'schema', 'v6'
  ));
end $function$;

NOTIFY pgrst, 'reload schema';
