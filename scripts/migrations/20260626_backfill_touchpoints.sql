-- Fase 6.2 — Backfill prospect_interactions -> prospect_touchpoints
-- Idempotente. Desliga trigger durante o backfill.

begin;

alter table public.prospect_touchpoints disable trigger prospect_touchpoint_advance;

with mapped as (
  select
    pi.prospect_id,
    pi.user_id,
    case
      when pi.kind in ('whatsapp','ligacao','email','reuniao','nota') then pi.kind
      when pi.kind in ('call','phone','telefone')                     then 'ligacao'
      when pi.kind in ('meeting','reuniao_agendada')                  then 'reuniao'
      when pi.kind in ('mail','e-mail')                               then 'email'
      when pi.kind in ('wpp','whats','zap')                           then 'whatsapp'
      else 'nota'
    end as tipo,
    nullif(pi.text, '') as mensagem,
    'enviado'::text as resultado,
    pi.created_at as enviado_em
  from public.prospect_interactions pi
)
insert into public.prospect_touchpoints (prospect_id, user_id, tipo, mensagem, resultado, enviado_em)
select m.prospect_id, m.user_id, m.tipo, m.mensagem, m.resultado, m.enviado_em
from mapped m
where not exists (
  select 1 from public.prospect_touchpoints t
  where t.prospect_id = m.prospect_id
    and t.tipo        = m.tipo
    and t.enviado_em  = m.enviado_em
    and t.resultado   = m.resultado
);

alter table public.prospect_touchpoints enable trigger prospect_touchpoint_advance;

-- Reconstrução de estado dos prospects (apenas contatos confirmados)
with agg as (
  select
    prospect_id,
    max(enviado_em)                                            as last_at,
    least(count(*) filter (where resultado <> 'tentativa'), 6) as steps
  from public.prospect_touchpoints
  group by prospect_id
)
update public.prospects p
   set last_contact_at = agg.last_at,
       cadence_step    = agg.steps,
       next_contact_at = coalesce(p.next_contact_at, agg.last_at + interval '2 days')
  from agg
 where p.id = agg.prospect_id;

commit;

select
  (select count(*) from public.prospect_interactions) as interactions_antigas,
  (select count(*) from public.prospect_touchpoints)  as touchpoints_total,
  (select count(*) from public.prospects where last_contact_at is not null) as prospects_contatados;
