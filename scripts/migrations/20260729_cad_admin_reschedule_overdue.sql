-- Reagenda leads vencidos nunca disparados, distribuindo N por dia
-- Sem janela de horário: usa o horário atual + offset diário

create or replace function public.cad_admin_reschedule_overdue(p_per_day int default 20)
returns table(rescheduled_count int, first_date timestamptz, last_date timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count int := 0;
  v_first timestamptz;
  v_last timestamptz;
begin
  if p_per_day is null or p_per_day < 1 then
    p_per_day := 20;
  end if;

  with overdue as (
    select l.id,
           row_number() over (order by l.next_action_at asc nulls last, l.id) as rn
    from public.cad_leads l
    where l.next_action_at < v_now
      and not exists (
        select 1 from public.cad_messages m where m.lead_id = l.id
      )
  ),
  upd as (
    update public.cad_leads l
    set next_action_at = v_now + make_interval(days => ((o.rn - 1) / p_per_day)::int)
                                + make_interval(mins => ((o.rn - 1) % p_per_day) * 5)
    from overdue o
    where l.id = o.id
    returning l.next_action_at
  )
  select count(*)::int, min(next_action_at), max(next_action_at)
    into v_count, v_first, v_last
  from upd;

  return query select v_count, v_first, v_last;
end;
$$;

grant execute on function public.cad_admin_reschedule_overdue(int) to authenticated, service_role;
