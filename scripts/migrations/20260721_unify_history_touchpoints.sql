-- ============================================================
-- Unificação do histórico de contatos
-- prospect_touchpoints passa a ser a ÚNICA fonte de verdade.
-- prospect_interactions vira legado (mantida só por compatibilidade).
-- ============================================================

begin;

-- 1) Estende prospect_touchpoints ------------------------------------------
-- 1.1) Coluna by_name para preservar autor (vinha de prospect_interactions).
alter table public.prospect_touchpoints
  add column if not exists by_name text;

-- 1.2) Expande CHECK de tipo para aceitar 'status' (mudanças de status do CRM).
-- Idempotente: remove qualquer CHECK antigo envolvendo a coluna tipo antes de recriar.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.prospect_touchpoints'::regclass
      and contype = 'c'
      and (
        conname = 'prospect_touchpoints_tipo_check'
        or pg_get_constraintdef(oid) ilike '%tipo%'
      )
  loop
    execute format('alter table public.prospect_touchpoints drop constraint if exists %I', r.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.prospect_touchpoints'::regclass
      and conname = 'prospect_touchpoints_tipo_check'
  ) then
    alter table public.prospect_touchpoints
      add constraint prospect_touchpoints_tipo_check
      check (tipo in ('whatsapp','ligacao','email','reuniao','nota','status'));
  end if;
end $$;

-- 2) Trigger de cadência: 'status' também não avança cadência ---------------
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
  select cadence_step into cur_step from prospects where id = new.prospect_id;

  -- nota e status não avançam cadência
  if new.tipo in ('nota','status') then
    return new;
  end if;

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

-- 3) Backfill desde prospect_interactions ----------------------------------
-- Trigger desligada durante o backfill: estamos importando histórico já
-- consolidado e NÃO queremos recalcular cadência/last_contact_at.
alter table public.prospect_touchpoints disable trigger prospect_touchpoint_advance;

with default_org as (
  select id from public.organizations order by created_at limit 1
),
src as (
  select
    i.prospect_id,
    i.user_id,
    case
      when i.kind in ('whatsapp','ligacao','email','reuniao','nota','status') then i.kind
      else 'nota'
    end as tipo,
    i.text       as mensagem,
    case
      when i.kind in ('nota','status') then 'enviado'
      else 'enviado'
    end as resultado,
    i.created_at as enviado_em,
    i.by_name,
    (select id from default_org) as organization_id
  from public.prospect_interactions i
)
insert into public.prospect_touchpoints
  (prospect_id, user_id, tipo, mensagem, resultado, enviado_em, by_name, organization_id)
select s.prospect_id, s.user_id, s.tipo, s.mensagem, s.resultado, s.enviado_em, s.by_name, s.organization_id
from src s
where s.organization_id is not null
  and not exists (
  select 1 from public.prospect_touchpoints t
  where t.prospect_id = s.prospect_id
    and t.user_id     = s.user_id
    and t.tipo        = s.tipo
    -- janela de 60s para deduplicar o mirror antigo do logAttempt.
    and abs(extract(epoch from (t.enviado_em - s.enviado_em))) < 60
);

alter table public.prospect_touchpoints enable trigger prospect_touchpoint_advance;

-- 4) Marcação informativa (não dropamos a tabela ainda) --------------------
comment on table public.prospect_interactions is
  'LEGADO — substituída por prospect_touchpoints como única fonte de verdade. Manter apenas para compatibilidade.';

commit;