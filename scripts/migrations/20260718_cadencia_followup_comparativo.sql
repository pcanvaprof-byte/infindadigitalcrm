-- ============================================================
-- Comparativo de follow-ups: previstos x realizados por dia
-- Janela: [today - N, today + N], default N = 14.
-- "Previsto" para dia D:
--   (a) histórico: cada touchpoint cuja data prevista de avanço
--       (enviado_em + intervalo do step) caia em D, considerando
--       APENAS touchpoints que já tiveram um seguinte (evita
--       contar duas vezes o snapshot do prospect ativo).
--   (b) futuro:  cada prospect ativo cujo next_contact_at::date = D.
-- "Realizado" em D: touchpoints reais (não 'tentativa', não 'nota')
--   gravados em D — i.e. avanços efetivos.
-- Desvio = realizados - previstos. Aderência = realizados / previstos.
-- ============================================================

create or replace function public.cadencia_followup_comparativo(_days int default 14)
returns table(
  dia            date,
  previstos      int,
  realizados     int,
  desvio         int,
  pct_aderencia  numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with
  intervals as (
    select step, days from (values
      (1::smallint, 1), (2::smallint, 3), (3::smallint, 7),
      (4::smallint, 15), (5::smallint, 21), (6::smallint, 30)
    ) v(step, days)
  ),
  t as (
    select pt.prospect_id, pt.enviado_em
    from public.prospect_touchpoints pt
    join public.prospects p on p.id = pt.prospect_id
    where p.user_id = auth.uid()
      and pt.resultado <> 'tentativa'
      and pt.tipo <> 'nota'
  ),
  t_ord as (
    select
      prospect_id,
      enviado_em,
      row_number() over (partition by prospect_id order by enviado_em)::smallint as rn,
      lead(enviado_em) over (partition by prospect_id order by enviado_em) as next_envio
    from t
  ),
  -- histórico: só conta touchpoints com seguimento real (evita duplicar com futuro)
  prev_hist as (
    select (t_ord.enviado_em + (i.days || ' days')::interval)::date as previsto_para
    from t_ord
    join intervals i on i.step = t_ord.rn
    where t_ord.next_envio is not null
  ),
  -- futuro: snapshot atual dos prospects ativos
  prev_fut as (
    select next_contact_at::date as previsto_para
    from public.prospects
    where user_id = auth.uid()
      and cadence_status = 'ativo'
      and next_contact_at is not null
      and next_contact_at::date >= current_date
  ),
  prev_agg as (
    select previsto_para as dia, count(*)::int as previstos
    from (
      select previsto_para from prev_hist
      union all
      select previsto_para from prev_fut
    ) u
    group by previsto_para
  ),
  real_agg as (
    select enviado_em::date as dia, count(*)::int as realizados
    from t
    group by enviado_em::date
  ),
  dias as (
    select (current_date - _days + g)::date as dia
    from generate_series(0, _days * 2) g
  )
  select
    d.dia,
    coalesce(p.previstos, 0)                                              as previstos,
    coalesce(r.realizados, 0)                                             as realizados,
    coalesce(r.realizados, 0) - coalesce(p.previstos, 0)                  as desvio,
    case when coalesce(p.previstos, 0) = 0 then null
         else round(100.0 * coalesce(r.realizados, 0) / p.previstos, 1)
    end                                                                   as pct_aderencia
  from dias d
  left join prev_agg p on p.dia = d.dia
  left join real_agg r on r.dia = d.dia
  order by d.dia;
$$;

grant execute on function public.cadencia_followup_comparativo(int) to authenticated;