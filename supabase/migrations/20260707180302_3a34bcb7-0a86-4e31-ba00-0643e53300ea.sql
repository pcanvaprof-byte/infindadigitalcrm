-- Templates de prospecção por nicho, editáveis por organização e versionados.
-- A versão "corrente" (is_current=true) é a que o app usa; as demais ficam
-- como histórico para restauração. Restaurar padrão = deletar a versão
-- corrente (o app cai no template hard-coded em src/lib/prospeccao/niche-templates.ts).

create table if not exists public.cad_niche_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id()
    references public.organizations(id) on delete cascade,
  niche_key text not null,
  corpo text not null,
  version integer not null default 1,
  is_current boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cad_niche_templates_niche_key_chk
    check (niche_key ~ '^[a-z0-9_]+$' and length(niche_key) between 1 and 40),
  constraint cad_niche_templates_corpo_chk
    check (length(corpo) between 1 and 5000)
);

create unique index if not exists cad_niche_templates_current_uq
  on public.cad_niche_templates (organization_id, niche_key)
  where is_current;

create index if not exists cad_niche_templates_hist_idx
  on public.cad_niche_templates (organization_id, niche_key, version desc);

grant select, insert, update, delete on public.cad_niche_templates to authenticated;
grant all on public.cad_niche_templates to service_role;

alter table public.cad_niche_templates enable row level security;

drop policy if exists cad_niche_templates_select on public.cad_niche_templates;
create policy cad_niche_templates_select on public.cad_niche_templates
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists cad_niche_templates_write on public.cad_niche_templates;
create policy cad_niche_templates_write on public.cad_niche_templates
  for all to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop trigger if exists trg_cad_niche_templates_updated_at on public.cad_niche_templates;
create trigger trg_cad_niche_templates_updated_at
  before update on public.cad_niche_templates
  for each row execute function public.cad_set_updated_at();

-- Salva uma nova versão como corrente e arquiva a anterior.
-- Devolve o id da versão recém-criada.
create or replace function public.cad_niche_template_save(
  _niche_key text,
  _corpo text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _org uuid := public.current_org_id();
  _next_version integer;
  _new_id uuid;
begin
  if _org is null then
    raise exception 'no active organization';
  end if;
  if _niche_key !~ '^[a-z0-9_]+$' then
    raise exception 'invalid niche_key';
  end if;

  select coalesce(max(version), 0) + 1
    into _next_version
    from public.cad_niche_templates
   where organization_id = _org and niche_key = _niche_key;

  update public.cad_niche_templates
     set is_current = false
   where organization_id = _org
     and niche_key = _niche_key
     and is_current;

  insert into public.cad_niche_templates
    (organization_id, niche_key, corpo, version, is_current, created_by)
  values
    (_org, _niche_key, _corpo, _next_version, true, auth.uid())
  returning id into _new_id;

  return _new_id;
end;
$$;

grant execute on function public.cad_niche_template_save(text, text) to authenticated;

-- Restaura o padrão do código: remove todas as versões dessa org+nicho.
-- O app volta a usar o template hard-coded.
create or replace function public.cad_niche_template_reset(
  _niche_key text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _org uuid := public.current_org_id();
  _deleted integer;
begin
  if _org is null then
    raise exception 'no active organization';
  end if;

  delete from public.cad_niche_templates
   where organization_id = _org and niche_key = _niche_key;
  get diagnostics _deleted = row_count;
  return _deleted;
end;
$$;

grant execute on function public.cad_niche_template_reset(text) to authenticated;

-- Reativa uma versão histórica como corrente.
create or replace function public.cad_niche_template_restore_version(
  _version_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _org uuid := public.current_org_id();
  _niche text;
  _corpo text;
  _new_id uuid;
begin
  if _org is null then
    raise exception 'no active organization';
  end if;

  select niche_key, corpo
    into _niche, _corpo
    from public.cad_niche_templates
   where id = _version_id and organization_id = _org;

  if _niche is null then
    raise exception 'version not found';
  end if;

  _new_id := public.cad_niche_template_save(_niche, _corpo);
  return _new_id;
end;
$$;

grant execute on function public.cad_niche_template_restore_version(uuid) to authenticated;