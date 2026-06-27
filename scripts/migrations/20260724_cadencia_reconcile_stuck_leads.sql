-- ============================================================================
-- Reconciliação de leads de cadência travados
--
-- Problema: SendMessageDialog no mobile usava window.location.href ANTES do
-- await registerSend(), matando o JS antes do INSERT em cad_messages /
-- update de stage. Resultado: leads em followup_N com WhatsApp disparado
-- mas sem advance e sem registro.
--
-- Esta migration:
--   1) Cria tabela de log cad_reconciliation_log
--   2) Cria função cad_reconcile_stuck_leads() — idempotente, segura para
--      rodar manualmente também
--   3) Executa o backfill UMA VEZ ao aplicar a migration
--
-- Política conservadora:
--   - Não toca leads em outcome
--   - Cross-check com prospect_touchpoints (whatsapp_*) para detectar envios
--     que aconteceram fora de cad_messages
--   - Avança 1 stage por envio detectado, recalcula next_action_at a partir
--     de last_contact_at (ou max touchpoint.created_at)
--   - Nunca regride
-- ============================================================================

create table if not exists public.cad_reconciliation_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  lead_id uuid not null,
  empresa text,
  prev_stage public.cad_stage,
  new_stage public.cad_stage,
  prev_next_action_at timestamptz,
  new_next_action_at timestamptz,
  reason text not null,
  evidence jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_cad_reconciliation_log_lead
  on public.cad_reconciliation_log(lead_id);
create index if not exists idx_cad_reconciliation_log_org_created
  on public.cad_reconciliation_log(organization_id, created_at desc);

grant select on public.cad_reconciliation_log to authenticated;
grant all on public.cad_reconciliation_log to service_role;

alter table public.cad_reconciliation_log enable row level security;

drop policy if exists "org members read reconciliation log" on public.cad_reconciliation_log;
create policy "org members read reconciliation log"
  on public.cad_reconciliation_log for select to authenticated
  using (organization_id = public.current_org_id());

-- ----------------------------------------------------------------------------
-- Função principal
-- ----------------------------------------------------------------------------
create or replace function public.cad_reconcile_stuck_leads(
  p_org uuid default null,
  p_dry_run boolean default false
) returns table (
  fixed_count integer,
  promoted_count integer,
  backfilled_messages integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_lead record;
  v_msg_count integer;
  v_tp_count integer;
  v_total_sends integer;
  v_target_stage public.cad_stage;
  v_base timestamptz;
  v_next_at timestamptz;
  v_steps integer;
  v_fixed integer := 0;
  v_promoted integer := 0;
  v_backfilled integer := 0;
  v_followup_order constant text[] := array[
    'followup_1','followup_2','followup_3','followup_4',
    'followup_5','followup_6','followup_7'
  ];
  v_current_idx integer;
  v_outcome constant public.cad_stage[] := array[
    'fechado'::public.cad_stage,
    'perdido'::public.cad_stage,
    'interessado'::public.cad_stage,
    'reuniao_agendada'::public.cad_stage,
    'proposta_enviada'::public.cad_stage,
    'negociacao'::public.cad_stage
  ];
begin
  for v_lead in
    select l.*
      from public.cad_leads l
     where l.stage = any(v_followup_order::public.cad_stage[])
       and (p_org is null or l.organization_id = p_org)
       and (
         -- Caso 1: last_contact_at > next_action_at (enviou e não avançou)
         (l.last_contact_at is not null
          and l.next_action_at is not null
          and l.last_contact_at > l.next_action_at)
         or
         -- Caso 2: tem touchpoint whatsapp posterior a last_contact_at
         exists (
           select 1 from public.prospect_touchpoints t
            where t.prospect_id = l.prospect_id
              and t.tipo in ('whatsapp_enviado','whatsapp_resposta')
              and t.created_at > coalesce(l.last_contact_at, l.created_at)
         )
       )
  loop
    -- Conta sends já registrados em cad_messages no stage atual ou posteriores
    select count(*)::int into v_msg_count
      from public.cad_messages m
     where m.lead_id = v_lead.id
       and m.direction = 'out'
       and m.tipo in ('whatsapp','email','ligacao');

    -- Conta touchpoints de envio para o prospect vinculado
    select count(*)::int into v_tp_count
      from public.prospect_touchpoints t
     where v_lead.prospect_id is not null
       and t.prospect_id = v_lead.prospect_id
       and t.tipo = 'whatsapp_enviado';

    v_total_sends := greatest(v_msg_count, v_tp_count);

    -- Sem evidência de envio → pula
    if v_total_sends = 0 then
      continue;
    end if;

    -- Posição atual no array (1-based)
    v_current_idx := array_position(v_followup_order, v_lead.stage::text);
    if v_current_idx is null then continue; end if;

    -- Calcula stage alvo: cada send avança 1 stage.
    -- v_total_sends sends => deveria estar no stage (followup_{sends+1}) ou outcome.
    -- Ex: 1 send => stage atual deveria ser followup_2 (idx 2).
    --     2 sends => followup_3, etc.
    v_steps := v_total_sends + 1 - v_current_idx;

    -- Já está correto ou à frente → pula
    if v_steps <= 0 then continue; end if;

    -- Avança limitado ao último follow-up
    declare
      v_target_idx integer := least(v_current_idx + v_steps, array_length(v_followup_order, 1));
    begin
      v_target_stage := v_followup_order[v_target_idx]::public.cad_stage;
    end;

    -- Base para recalcular next_action_at: max(last_contact_at, max touchpoint)
    select greatest(
             coalesce(v_lead.last_contact_at, v_lead.created_at),
             coalesce((select max(t.created_at)
                         from public.prospect_touchpoints t
                        where v_lead.prospect_id is not null
                          and t.prospect_id = v_lead.prospect_id
                          and t.tipo = 'whatsapp_enviado'), v_lead.created_at)
           ) into v_base;

    v_next_at := public.cad_next_action_for_stage(v_target_stage, v_base);

    -- Backfill de cad_messages se touchpoint > cad_messages
    if v_tp_count > v_msg_count then
      if not p_dry_run then
        insert into public.cad_messages (
          lead_id, organization_id, tipo, direction,
          stage_at_send, mensagem, status, created_at
        )
        select v_lead.id,
               v_lead.organization_id,
               'whatsapp'::public.cad_msg_tipo,
               'out'::public.cad_msg_direction,
               v_lead.stage,
               coalesce(t.conteudo, '[reconciliado] envio detectado em prospect_touchpoints'),
               'enviada'::public.cad_msg_status,
               t.created_at
          from public.prospect_touchpoints t
         where t.prospect_id = v_lead.prospect_id
           and t.tipo = 'whatsapp_enviado'
           and t.created_at > coalesce(v_lead.last_contact_at, v_lead.created_at)
         order by t.created_at;
      end if;
      v_backfilled := v_backfilled + (v_tp_count - v_msg_count);
    end if;

    -- Update do lead
    if not p_dry_run then
      update public.cad_leads
         set stage = v_target_stage,
             next_action_at = v_next_at,
             last_contact_at = greatest(coalesce(last_contact_at, v_base), v_base)
       where id = v_lead.id;
    end if;

    insert into public.cad_reconciliation_log (
      organization_id, lead_id, empresa,
      prev_stage, new_stage,
      prev_next_action_at, new_next_action_at,
      reason, evidence
    ) values (
      v_lead.organization_id, v_lead.id, v_lead.empresa,
      v_lead.stage, v_target_stage,
      v_lead.next_action_at, v_next_at,
      case when p_dry_run then 'dry-run: stuck_send_detected' else 'stuck_send_detected' end,
      jsonb_build_object(
        'cad_messages_out', v_msg_count,
        'touchpoints_whatsapp_enviado', v_tp_count,
        'total_sends', v_total_sends,
        'steps_advanced', v_target_stage::text,
        'base_used', v_base
      )
    );

    v_fixed := v_fixed + 1;
    if v_target_stage <> v_lead.stage then v_promoted := v_promoted + 1; end if;
  end loop;

  return query select v_fixed, v_promoted, v_backfilled;
end $$;

grant execute on function public.cad_reconcile_stuck_leads(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Executa o backfill UMA VEZ ao aplicar a migration (todas as orgs)
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  select * into r from public.cad_reconcile_stuck_leads(null, false);
  raise notice 'cad_reconcile_stuck_leads: fixed=%, promoted=%, backfilled_messages=%',
    r.fixed_count, r.promoted_count, r.backfilled_messages;
end $$;
