-- Auditoria dos 381 leads "atrasados": duplicados? órfãos? sem owner? estágio zumbi?
-- READ-ONLY: apenas seleciona. Rode tudo e me mande os resultados.

-- 1) Total de atrasados (deve bater com o card do dashboard)
select count(*) as total_atrasados
from public.cad_leads
where next_action_at is not null
  and next_action_at < now()
  and coalesce(stage::text, '') not in ('perdido', 'fechado', 'cliente');

-- 2) Quebra por estágio
select stage, count(*) as qt
from public.cad_leads
where next_action_at < now()
  and coalesce(stage::text, '') not in ('perdido', 'fechado', 'cliente')
group by stage
order by qt desc;

-- 3) Atraso em dias (faixas)
select
  case
    when now() - next_action_at < interval '1 day'  then 'a) < 1 dia'
    when now() - next_action_at < interval '3 days' then 'b) 1-3 dias'
    when now() - next_action_at < interval '7 days' then 'c) 3-7 dias'
    when now() - next_action_at < interval '30 days' then 'd) 7-30 dias'
    else 'e) > 30 dias'
  end as faixa,
  count(*) as qt
from public.cad_leads
where next_action_at < now()
  and coalesce(stage::text, '') not in ('perdido', 'fechado', 'cliente')
group by 1 order by 1;

-- 4) Quantos sem owner / sem org
select
  count(*) filter (where owner_id is null) as sem_owner,
  count(*) filter (where organization_id is null) as sem_org,
  count(*) as total
from public.cad_leads
where next_action_at < now()
  and coalesce(stage::text, '') not in ('perdido', 'fechado', 'cliente');

-- 5) Duplicados remanescentes entre os atrasados (por telefone normalizado)
with atrasados as (
  select id, organization_id, public.cad_norm_phone(whatsapp) as ph, empresa, stage
  from public.cad_leads
  where next_action_at < now()
    and coalesce(stage::text, '') not in ('perdido', 'fechado', 'cliente')
    and public.cad_norm_phone(whatsapp) is not null
)
select organization_id, ph, count(*) as cards, array_agg(empresa) as empresas
from atrasados
group by organization_id, ph
having count(*) > 1
order by cards desc
limit 50;

-- 6) Duplicados por empresa (nome normalizado)
with atrasados as (
  select id, organization_id, lower(regexp_replace(coalesce(empresa,''),'[^a-z0-9]+','','g')) as nm, stage
  from public.cad_leads
  where next_action_at < now()
    and coalesce(stage::text, '') not in ('perdido', 'fechado', 'cliente')
)
select organization_id, nm, count(*) as cards
from atrasados
where length(nm) > 3
group by organization_id, nm
having count(*) > 1
order by cards desc
limit 50;

-- 7) Zumbis: estágio 'novo' mas com next_action_at antigo
select count(*) as zumbis_novo
from public.cad_leads
where next_action_at < now() - interval '1 day'
  and stage::text = 'novo';

-- 8) Amostra crua (20 mais antigos)
select id, empresa, stage, owner_id, organization_id,
       next_action_at, now() - next_action_at as atraso, last_message_at
from public.cad_leads
where next_action_at < now()
  and coalesce(stage::text, '') not in ('perdido', 'fechado', 'cliente')
order by next_action_at asc
limit 20;