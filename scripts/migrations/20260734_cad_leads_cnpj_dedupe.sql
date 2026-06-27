-- ============================================================================
-- Trava de duplicatas por CNPJ (mais confiável que nome de empresa)
-- ============================================================================
-- 1) Adiciona coluna cnpj em cad_leads (digits-only, 14 chars).
-- 2) Backfill a partir de prospects.cnpj.
-- 3) Índice único parcial por (organization_id, cnpj) — só quando cnpj válido.
-- 4) Mantém índice por empresa, mas só bloqueia quando NÃO houver cnpj
--    (assim "Padaria Central" matriz e filial podem coexistir se tiverem CNPJs distintos).
-- 5) Atualiza cad_admin_backfill_import_prospects para gravar cnpj e
--    deduplicar por cnpj quando presente, caindo em empresa só se vazio.

-- 1) coluna
alter table public.cad_leads
  add column if not exists cnpj text;

-- normaliza para 14 dígitos (ou null)
create or replace function public.cad_normalize_cnpj(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    when length(regexp_replace(p, '\D', '', 'g')) = 14
      then regexp_replace(p, '\D', '', 'g')
    else null
  end
$$;

-- 2) backfill: pega cnpj do prospect quando o lead tem prospect_id
update public.cad_leads cl
   set cnpj = public.cad_normalize_cnpj(p.cnpj)
  from public.prospects p
 where cl.prospect_id = p.id
   and cl.cnpj is null
   and public.cad_normalize_cnpj(p.cnpj) is not null;

-- 3) índice único por CNPJ
drop index if exists ux_cad_leads_org_empresa_norm;

create unique index if not exists ux_cad_leads_org_cnpj
  on public.cad_leads (organization_id, cnpj)
  where cnpj is not null;

-- 4) índice por empresa apenas quando cnpj é null (fallback)
create unique index if not exists ux_cad_leads_org_empresa_no_cnpj
  on public.cad_leads (organization_id, lower(btrim(empresa)))
  where cnpj is null
    and empresa is not null
    and btrim(empresa) <> '';

-- 5) RPC de importação com CNPJ
drop function if exists public.cad_admin_backfill_import_prospects(text[]);

create or replace function public.cad_admin_backfill_import_prospects(
  p_statuses text[] default array['primeiro_contato']
)
returns table (imported int, skipped int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_imported int := 0;
  v_total int := 0;
begin
  select count(*) into v_total
    from public.prospects p
   where p.status = any(p_statuses)
     and not exists (
       select 1 from public.cad_leads cl where cl.prospect_id = p.id
     )
     and not exists (
       select 1
         from public.cad_leads cl2
        where cl2.organization_id = public.cad_resolve_org_for_user(p.user_id)
          and cl2.cnpj is not null
          and cl2.cnpj = public.cad_normalize_cnpj(p.cnpj)
     )
     and not exists (
       -- fallback: bloqueia por nome só quando o prospect não tem cnpj
       select 1
         from public.cad_leads cl3
        where public.cad_normalize_cnpj(p.cnpj) is null
          and cl3.organization_id = public.cad_resolve_org_for_user(p.user_id)
          and cl3.cnpj is null
          and cl3.empresa is not null
          and lower(btrim(cl3.empresa)) = lower(btrim(coalesce(p.company, 'Sem nome')))
     );

  with inserted as (
    insert into public.cad_leads (
      organization_id, owner_id, prospect_id,
      empresa, cnpj, responsavel, cargo, telefone, whatsapp,
      primeira_abordagem_at, stage, next_action_at
    )
    select
      public.cad_resolve_org_for_user(p.user_id),
      p.user_id,
      p.id,
      coalesce(p.company, 'Sem nome'),
      public.cad_normalize_cnpj(p.cnpj),
      p.owner_name,
      null::text,
      p.phone,
      p.whatsapp,
      coalesce(public.cad_last_touchpoint_at(p.id), p.created_at, now()),
      'followup_1'::public.cad_stage,
      coalesce(public.cad_last_touchpoint_at(p.id), p.created_at, now()) + interval '2 days'
    from public.prospects p
   where p.status = any(p_statuses)
     and not exists (
       select 1 from public.cad_leads cl where cl.prospect_id = p.id
     )
     and not exists (
       select 1
         from public.cad_leads cl2
        where cl2.organization_id = public.cad_resolve_org_for_user(p.user_id)
          and cl2.cnpj is not null
          and cl2.cnpj = public.cad_normalize_cnpj(p.cnpj)
     )
     and not exists (
       select 1
         from public.cad_leads cl3
        where public.cad_normalize_cnpj(p.cnpj) is null
          and cl3.organization_id = public.cad_resolve_org_for_user(p.user_id)
          and cl3.cnpj is null
          and cl3.empresa is not null
          and lower(btrim(cl3.empresa)) = lower(btrim(coalesce(p.company, 'Sem nome')))
     )
    on conflict do nothing
    returning 1
  )
  select count(*) into v_imported from inserted;

  imported := v_imported;
  skipped := greatest(v_total - v_imported, 0);
  return next;
end;
$$;

grant execute on function public.cad_admin_backfill_import_prospects(text[]) to authenticated, service_role;
grant execute on function public.cad_normalize_cnpj(text) to authenticated, service_role;