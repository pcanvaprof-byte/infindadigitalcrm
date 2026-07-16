
CREATE OR REPLACE FUNCTION public.advance_prospect_cadence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  intervals int[] := array[1,3,7,15,21];
  cur_step smallint; nxt_step smallint; nxt_at timestamptz;
  new_resp text; new_cad text;
  v_org uuid;
begin
  if new.user_id is null then return new; end if;

  select organization_id into v_org from public.prospects where id = new.prospect_id;

  -- Garante estado privado do usuário para este lead
  insert into public.user_lead_state (prospect_id, user_id, organization_id)
  values (new.prospect_id, new.user_id, coalesce(v_org, public.current_org_id()))
  on conflict (prospect_id, user_id) do nothing;

  if new.tipo in ('nota','status','resposta') then
    if new.tipo = 'resposta' then
      update public.user_lead_state
         set response_status = coalesce(nullif(response_status,'sem_resposta'), 'respondeu'),
             updated_at = now()
       where prospect_id = new.prospect_id and user_id = new.user_id;
    end if;
    return new;
  end if;

  select cadence_step into cur_step
    from public.user_lead_state
   where prospect_id = new.prospect_id and user_id = new.user_id;
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
    when 'respondido' then 'respondeu'
    when 'interessado' then 'interessado'
    when 'sem_interesse' then 'sem_interesse'
    else null end;

  update public.user_lead_state set
    cadence_step = nxt_step,
    cadence_status = new_cad,
    last_contact_at = new.enviado_em,
    next_contact_at = nxt_at,
    response_status = coalesce(new_resp, response_status),
    closed_at = case when new_cad = 'encerrado' then now() else closed_at end,
    closed_reason = case when new.resultado = 'sem_interesse' then 'sem_interesse'
                          when nxt_step >= 6 then 'cadencia_concluida'
                          else closed_reason end,
    updated_at = now()
  where prospect_id = new.prospect_id and user_id = new.user_id;

  return new;
end
$function$;
