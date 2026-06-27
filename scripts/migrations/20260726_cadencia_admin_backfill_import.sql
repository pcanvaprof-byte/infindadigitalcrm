-- ============================================================================
-- Admin backfill: importa prospects órfãos para cad_leads
-- ============================================================================

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
      coalesce(
        -- 1) organização já usada por outro cad_lead do mesmo dono
        (select cl2.organization_id from public.cad_leads cl2
          where cl2.owner_id = p.user_id and cl2.organization_id is not null
          order by cl2.created_at asc limit 1),
        -- 2) organização já usada em outro prospect do mesmo dono (se a coluna existir)
        (select pr.organization_id from public.prospects pr
          where pr.user_id = p.user_id and pr.organization_id is not null
          order by pr.created_at asc limit 1),
        -- 3) fallback: primeira organização do sistema
        (select id from public.organizations order by created_at asc limit 1)
      ),
      p.user_id,
      p.id,
      coalesce(p.company, 'Sem nome'),
      p.owner_name,
      null::text,
      p.phone,
      p.whatsapp,
      coalesce(
        (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id),
        p.created_at,
        now()
      ),
      'followup_1'::public.cad_stage,
      coalesce(
        (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id),
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
