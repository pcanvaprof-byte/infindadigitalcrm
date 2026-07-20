drop index if exists public.ux_cad_leads_prospect;

create unique index if not exists cad_leads_prospect_owner_uniq
  on public.cad_leads (prospect_id, owner_id)
  where prospect_id is not null;

create or replace function public.cad_import_from_prospects(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_org uuid;
  v_uid uuid;
begin
  v_org := public.current_org_id();
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.cad_leads (
    organization_id, owner_id, prospect_id, empresa, responsavel, cargo, telefone, whatsapp,
    primeira_abordagem_at, stage, next_action_at
  )
  select
    v_org,
    v_uid,
    p.id,
    coalesce(p.company, 'Sem nome'),
    p.owner_name,
    null::text,
    p.phone,
    p.whatsapp,
    coalesce(
      (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id and t.user_id = v_uid),
      p.created_at,
      now()
    ),
    'followup_1'::public.cad_stage,
    coalesce(
      (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id and t.user_id = v_uid),
      p.created_at,
      now()
    ) + interval '2 days'
  from public.prospects p
  where p.organization_id = v_org
    and (p_ids is null or p.id = any(p_ids))
    and (
      p.user_id = v_uid
      or exists (
        select 1
        from public.prospect_touchpoints t
        where t.prospect_id = p.id
          and t.user_id = v_uid
          and t.tipo in ('whatsapp', 'ligacao', 'email')
      )
      or exists (
        select 1
        from public.prospect_interactions i
        where i.prospect_id = p.id
          and i.user_id = v_uid
          and i.kind in ('whatsapp', 'ligacao', 'email')
      )
    )
    and not exists (
      select 1
      from public.cad_leads cl
      where cl.prospect_id = p.id
        and cl.owner_id = v_uid
    )
    and not exists (
      select 1
      from public.cad_leads cl
      where cl.organization_id = v_org
        and cl.owner_id = v_uid
        and cl.stage is distinct from 'perdido'::public.cad_stage
        and public.cad_norm_phone(cl.whatsapp) is not null
        and public.cad_norm_phone(cl.whatsapp) = public.cad_norm_phone(p.whatsapp)
    )
    and not exists (
      select 1
      from public.cad_leads cl
      where cl.organization_id = v_org
        and cl.owner_id = v_uid
        and cl.stage is distinct from 'perdido'::public.cad_stage
        and public.cad_norm_phone(cl.telefone) is not null
        and public.cad_norm_phone(cl.telefone) = public.cad_norm_phone(p.phone)
    );

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.cad_import_from_prospects(uuid[]) to authenticated;