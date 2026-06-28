-- Dedupe focado nos leads ATRASADOS que ainda têm duplicata por telefone normalizado.
-- Seguro: reaproveita cad_norm_phone / cad_stage_rank / _cad_merge_losers_into já criados em 20260738.
-- Mantém o card vencedor (estágio mais avançado, depois mais recente) e remove os demais
-- após migrar mensagens e notificações.

create or replace function public.cad_admin_dedupe_overdue()
returns table(grupos int, removidos int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_winner uuid;
  v_losers uuid[];
  v_grupos int := 0;
  v_removidos int := 0;
begin
  for r in
    with atrasados as (
      select id, organization_id, public.cad_norm_phone(whatsapp) as ph,
             stage, last_message_at, created_at
      from public.cad_leads
      where next_action_at < now()
        and coalesce(stage::text,'') not in ('perdido','fechado','cliente')
        and public.cad_norm_phone(whatsapp) is not null
    )
    select organization_id, ph, array_agg(id) as ids
    from atrasados
    group by organization_id, ph
    having count(*) > 1
  loop
    select id into v_winner
    from public.cad_leads
    where id = any(r.ids)
    order by public.cad_stage_rank(stage) desc nulls last,
             coalesce(last_message_at, created_at) desc nulls last
    limit 1;

    v_losers := array(select unnest(r.ids) except select v_winner);
    if array_length(v_losers,1) is null then continue; end if;

    perform public._cad_merge_losers_into(v_winner, v_losers);
    delete from public.cad_leads where id = any(v_losers);

    v_grupos := v_grupos + 1;
    v_removidos := v_removidos + array_length(v_losers,1);
  end loop;

  return query select v_grupos, v_removidos;
end$$;

grant execute on function public.cad_admin_dedupe_overdue() to authenticated, service_role;

-- Execução imediata
select * from public.cad_admin_dedupe_overdue();

-- Conferência pós-execução: deve retornar 0 linhas
with atrasados as (
  select id, organization_id, public.cad_norm_phone(whatsapp) as ph
  from public.cad_leads
  where next_action_at < now()
    and coalesce(stage::text,'') not in ('perdido','fechado','cliente')
    and public.cad_norm_phone(whatsapp) is not null
)
select organization_id, ph, count(*) as cards
from atrasados
group by organization_id, ph
having count(*) > 1
order by cards desc;