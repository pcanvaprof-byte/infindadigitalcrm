-- ============================================================================
-- Admin backfill: importa prospects órfãos para cad_leads
-- ============================================================================

-- Resolve a organização sem assumir colunas que podem não existir em bases antigas.
-- Mantém a migration aditiva: não apaga, não reseta e não altera dados existentes.
create or replace function public.cad_resolve_org_for_user(p_user uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
begin
  if p_user is not null and to_regclass('public.cad_leads') is not null then
    execute '
      select organization_id
        from public.cad_leads
       where owner_id = $1
         and organization_id is not null
       order by created_at asc
       limit 1'
      into v_org
      using p_user;

    if v_org is not null then
      return v_org;
    end if;
  end if;

  if p_user is not null and to_regclass('public.user_active_org') is not null then
    execute '
      select organization_id
        from public.user_active_org
       where user_id = $1
       limit 1'
      into v_org
      using p_user;

    if v_org is not null then
      return v_org;
    end if;
  end if;

  if p_user is not null and to_regclass('public.organization_members') is not null then
    execute '
      select organization_id
        from public.organization_members
       where user_id = $1
       limit 1'
      into v_org
      using p_user;

    if v_org is not null then
      return v_org;
    end if;
  end if;

  select id into v_org
    from public.organizations
   order by created_at asc
   limit 1;

  if v_org is null then
    insert into public.organizations (name)
    values ('INFINDA')
    returning id into v_org;
  end if;

  return v_org;
end $$;

grant execute on function public.cad_resolve_org_for_user(uuid) to authenticated, service_role;

create or replace function public.cad_last_touchpoint_at(p_prospect uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
begin
  if to_regclass('public.prospect_touchpoints') is null then
    return null;
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'prospect_touchpoints'
       and column_name = 'enviado_em'
  ) then
    return null;
  end if;

  execute '
    select max(enviado_em)
      from public.prospect_touchpoints
     where prospect_id = $1'
    into v_last
    using p_prospect;

  return v_last;
end $$;

grant execute on function public.cad_last_touchpoint_at(uuid) to authenticated, service_role;

create or replace function public.cad_admin_backfill_import_prospects(
  p_statuses text[] default array['primeiro_contato']
)
returns table (imported int, skipped int)
language plpgsql security definer set search_path = public as $$
declare
  v_imported int := 0;
  v_total    int := 0;
begin
  select count(*) into v_total
    from public.prospects p
   where p.status = any(p_statuses)
     and not exists (select 1 from public.cad_leads cl where cl.prospect_id = p.id);

  with inserted as (
    insert into public.cad_leads (
      organization_id, owner_id, prospect_id, empresa, responsavel, cargo,
      telefone, whatsapp, primeira_abordagem_at, stage, next_action_at
    )
    select
      public.cad_resolve_org_for_user(p.user_id),
      p.user_id,
      p.id,
      coalesce(p.company, 'Sem nome'),
      p.owner_name,
      null::text,
      p.phone,
      p.whatsapp,
      coalesce(
        public.cad_last_touchpoint_at(p.id),
        p.created_at,
        now()
      ),
      'followup_1'::public.cad_stage,
      coalesce(
        public.cad_last_touchpoint_at(p.id),
        p.created_at,
        now()
      ) + interval '2 days'
      from public.prospects p
     where p.status = any(p_statuses)
       and not exists (select 1 from public.cad_leads cl where cl.prospect_id = p.id)
    returning 1
  )
  select count(*) into v_imported from inserted;

  imported := v_imported;
  skipped  := v_total - v_imported;
  return next;
end $$;

grant execute on function public.cad_admin_backfill_import_prospects(text[]) to authenticated;
