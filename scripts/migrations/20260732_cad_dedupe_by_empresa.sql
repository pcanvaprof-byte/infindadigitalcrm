-- Estende dedup para mesclar leads com mesma empresa (case-insensitive),
-- mesmo quando os prospect_ids são diferentes (duplicação de prospect).
-- Mantém o lead mais antigo (com last_contact_at) e remove os demais,
-- repointando cad_messages e cad_notifications.

create or replace function public.cad_admin_dedupe_by_empresa()
returns table (merged int, removed int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged int := 0;
  v_removed int := 0;
  r record;
  v_winner uuid;
  v_losers uuid[];
begin
  for r in
    select organization_id, lower(empresa) as empresa_key, array_agg(id) as ids
      from public.cad_leads
     where empresa is not null and trim(empresa) <> ''
     group by organization_id, lower(empresa)
    having count(*) > 1
  loop
    select id into v_winner
      from public.cad_leads
     where id = any(r.ids)
     order by (last_contact_at is null) asc, created_at asc
     limit 1;
    if v_winner is null then continue; end if;

    v_losers := array(select id from unnest(r.ids) as id where id <> v_winner);
    if array_length(v_losers, 1) is null then continue; end if;

    update public.cad_messages set lead_id = v_winner where lead_id = any(v_losers);
    begin
      update public.cad_notifications set lead_id = v_winner where lead_id = any(v_losers);
    exception when undefined_table then null; end;

    delete from public.cad_leads where id = any(v_losers);
    v_merged := v_merged + 1;
    v_removed := v_removed + array_length(v_losers, 1);
  end loop;

  merged := v_merged;
  removed := v_removed;
  return next;
end;
$$;

grant execute on function public.cad_admin_dedupe_by_empresa() to authenticated, service_role;
