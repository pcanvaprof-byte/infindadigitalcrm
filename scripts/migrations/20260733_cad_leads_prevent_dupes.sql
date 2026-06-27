-- ============================================================================
-- Bloqueio definitivo de duplicatas em cad_leads
-- ============================================================================
-- 1) Índices únicos parciais por organização:
--    - prospect_id (quando presente)
--    - lower(empresa) (quando presente)
-- 2) Atualiza cad_admin_backfill_import_prospects para também ignorar leads
--    cuja empresa (normalizada) já exista na mesma organização.
-- 3) ON CONFLICT DO NOTHING como segunda barreira.

-- Limpeza preventiva: garante que não há duplicatas residuais antes do índice.
-- (Se houver, o create index falha; o admin deve rodar dedupe antes.)

create unique index if not exists ux_cad_leads_org_prospect
  on public.cad_leads (organization_id, prospect_id)
  where prospect_id is not null;

create unique index if not exists ux_cad_leads_org_empresa_norm
  on public.cad_leads (organization_id, lower(btrim(empresa)))
  where empresa is not null and btrim(empresa) <> '';

-- Recria a RPC de importação com dupla checagem (prospect_id + empresa) e
-- ON CONFLICT DO NOTHING como rede de segurança.
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
       select 1
         from public.cad_leads cl
        where cl.prospect_id = p.id
     )
     and not exists (
       select 1
         from public.cad_leads cl2
        where cl2.organization_id = public.cad_resolve_org_for_user(p.user_id)
          and cl2.empresa is not null
          and lower(btrim(cl2.empresa)) = lower(btrim(coalesce(p.company, 'Sem nome')))
     );

  with inserted as (
    insert into public.cad_leads (
      organization_id,
      owner_id,
      prospect_id,
      empresa,
      responsavel,
      cargo,
      telefone,
      whatsapp,
      primeira_abordagem_at,
      stage,
      next_action_at
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
      coalesce(public.cad_last_touchpoint_at(p.id), p.created_at, now()),
      'followup_1'::public.cad_stage,
      coalesce(public.cad_last_touchpoint_at(p.id), p.created_at, now()) + interval '2 days'
    from public.prospects p
   where p.status = any(p_statuses)
     and not exists (
       select 1
         from public.cad_leads cl
        where cl.prospect_id = p.id
     )
     and not exists (
       select 1
         from public.cad_leads cl2
        where cl2.organization_id = public.cad_resolve_org_for_user(p.user_id)
          and cl2.empresa is not null
          and lower(btrim(cl2.empresa)) = lower(btrim(coalesce(p.company, 'Sem nome')))
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