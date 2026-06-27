-- ============================================================================
-- Auditoria + reconciliação estendida dos leads travados em followup_*
--
-- Motivação: após rodar cad_reconcile_stuck_leads, restaram ~183 leads em
-- followup_*. Precisamos saber POR QUE estão lá:
--
--   bucket A: enviou mais vezes do que o stage indica (deveria avançar)
--             — coberto pelo reconciler anterior se houve Caso1/Caso2.
--             Aqui pegamos os que ele NÃO viu (sem touchpoint e sem
--             last_contact_at > next_action_at).
--   bucket B: scheduled — next_action_at no futuro, contagens consistentes.
--   bucket C: overdue, sem nenhum envio (cad_messages=0 e tp=0).
--             Lead nunca foi disparado mas ficou pendente.
--   bucket D: sem prospect_id e sem cad_messages — órfão.
--   bucket E: outros (inconsistências).
-- ============================================================================

create or replace view public.cad_followup_audit as
with base as (
  select l.id, l.organization_id, l.empresa, l.stage, l.prospect_id,
         l.next_action_at, l.last_contact_at, l.created_at,
         array_position(
           array['followup_1','followup_2','followup_3','followup_4',
                 'followup_5','followup_6','followup_7'],
           l.stage::text) as stage_idx,
         (select count(*) from public.cad_messages m
           where m.lead_id = l.id and m.direction = 'out'
             and m.tipo in ('whatsapp','email','ligacao')) as msgs_out,
         (select count(*) from public.prospect_touchpoints t
           where l.prospect_id is not null
             and t.prospect_id = l.prospect_id
             and t.tipo = 'whatsapp_enviado') as tp_sends
    from public.cad_leads l
   where l.stage::text like 'followup_%'
)
select b.*,
       greatest(b.msgs_out, b.tp_sends) as total_sends,
       case
         when greatest(b.msgs_out, b.tp_sends) + 1 > b.stage_idx
           then 'A_should_advance'
         when greatest(b.msgs_out, b.tp_sends) = 0 and b.prospect_id is null
           then 'D_orphan_no_prospect'
         when greatest(b.msgs_out, b.tp_sends) = 0
              and b.next_action_at is not null and b.next_action_at < now()
           then 'C_overdue_never_sent'
         when b.next_action_at is not null and b.next_action_at >= now()
           then 'B_scheduled'
         when greatest(b.msgs_out, b.tp_sends) + 1 = b.stage_idx
           then 'B_consistent'
         else 'E_other'
       end as bucket
  from base b;

grant select on public.cad_followup_audit to authenticated;

-- Resumo agregado para diagnóstico rápido
create or replace function public.cad_followup_audit_summary(p_org uuid default null)
returns table (bucket text, qtd bigint, exemplo_empresas text)
language sql security definer set search_path = public as $$
  select bucket,
         count(*) as qtd,
         string_agg(empresa, ', ' order by created_at desc)
           filter (where empresa is not null) as exemplo_empresas
    from (
      select bucket, empresa, created_at,
             row_number() over (partition by bucket order by created_at desc) as rn
        from public.cad_followup_audit
       where (p_org is null or organization_id = p_org)
    ) s
   where rn <= 5
   group by bucket
   order by qtd desc;
$$;

grant execute on function public.cad_followup_audit_summary(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Reconciler v2: cobre bucket A mesmo sem touchpoint
-- (usa apenas msgs_out vs stage_idx)
-- ----------------------------------------------------------------------------
create or replace function public.cad_reconcile_stuck_leads_v2(
  p_org uuid default null,
  p_dry_run boolean default false
) returns table (fixed_count integer, promoted_count integer)
language plpgsql security definer set search_path = public as $$
declare
  v record;
  v_fu constant text[] := array['followup_1','followup_2','followup_3','followup_4',
                                 'followup_5','followup_6','followup_7'];
  v_target_idx integer;
  v_target_stage public.cad_stage;
  v_base timestamptz;
  v_next_at timestamptz;
  v_fixed int := 0;
  v_promoted int := 0;
begin
  for v in
    select * from public.cad_followup_audit
     where bucket = 'A_should_advance'
       and (p_org is null or organization_id = p_org)
  loop
    v_target_idx := least(v.total_sends + 1, array_length(v_fu, 1));
    v_target_stage := v_fu[v_target_idx]::public.cad_stage;

    select greatest(
             coalesce(v.last_contact_at, v.created_at),
             coalesce((select max(m.created_at) from public.cad_messages m
                        where m.lead_id = v.id and m.direction = 'out'),
                      v.created_at),
             coalesce((select max(t.created_at) from public.prospect_touchpoints t
                        where v.prospect_id is not null
                          and t.prospect_id = v.prospect_id
                          and t.tipo = 'whatsapp_enviado'),
                      v.created_at)
           ) into v_base;

    v_next_at := public.cad_next_action_for_stage(v_target_stage, v_base);

    if not p_dry_run then
      update public.cad_leads
         set stage = v_target_stage,
             next_action_at = v_next_at,
             last_contact_at = greatest(coalesce(last_contact_at, v_base), v_base)
       where id = v.id;
    end if;

    insert into public.cad_reconciliation_log (
      organization_id, lead_id, empresa,
      prev_stage, new_stage,
      prev_next_action_at, new_next_action_at,
      reason, evidence
    ) values (
      v.organization_id, v.id, v.empresa,
      v.stage, v_target_stage,
      v.next_action_at, v_next_at,
      case when p_dry_run then 'dry-run: v2_should_advance' else 'v2_should_advance' end,
      jsonb_build_object(
        'msgs_out', v.msgs_out,
        'tp_sends', v.tp_sends,
        'total_sends', v.total_sends,
        'stage_idx', v.stage_idx,
        'target_idx', v_target_idx
      )
    );

    v_fixed := v_fixed + 1;
    if v_target_stage <> v.stage then v_promoted := v_promoted + 1; end if;
  end loop;

  return query select v_fixed, v_promoted;
end $$;

grant execute on function public.cad_reconcile_stuck_leads_v2(uuid, boolean) to authenticated;

-- Roda o v2 ao aplicar
do $$
declare r record;
begin
  select * into r from public.cad_reconcile_stuck_leads_v2(null, false);
  raise notice 'cad_reconcile_stuck_leads_v2: fixed=%, promoted=%',
    r.fixed_count, r.promoted_count;
end $$;
