-- Execute no SEU Supabase (oxmhwwopxurwqcrwgsyf) via SQL Editor.
-- Cria RPC que garante que o usuário atual pertença a uma organização,
-- criando/vinculando de forma idempotente. Rodou com SECURITY DEFINER
-- para contornar RLS de INSERT em organization_members.

create or replace function public.ensure_current_user_membership()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  -- 1) Já tem org ativa?
  select organization_id into v_org from public.user_active_org where user_id = v_uid;
  if v_org is not null then
    return v_org;
  end if;

  -- 2) Já é membro de alguma org?
  select organization_id into v_org
    from public.organization_members
   where user_id = v_uid
   order by joined_at asc
   limit 1;

  -- 3) Bootstrap: usa a org mais antiga; se não houver, cria "Minha organização".
  if v_org is null then
    select id into v_org from public.organizations order by created_at asc limit 1;
    if v_org is null then
      insert into public.organizations (name, slug, created_by)
      values ('Minha organização', 'org-' || substr(v_uid::text, 1, 8), v_uid)
      returning id into v_org;
    end if;

    insert into public.organization_members (organization_id, user_id, role)
    values (v_org, v_uid, 'admin')
    on conflict (organization_id, user_id) do nothing;
  end if;

  insert into public.user_active_org (user_id, organization_id)
  values (v_uid, v_org)
  on conflict (user_id) do update set organization_id = excluded.organization_id, updated_at = now();

  return v_org;
end
$$;

grant execute on function public.ensure_current_user_membership() to authenticated;
