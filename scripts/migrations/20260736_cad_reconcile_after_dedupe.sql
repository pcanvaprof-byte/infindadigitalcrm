-- ============================================================================
-- Reconciliação pós-deduplicação:
-- Leads cujo último envio (cad_messages.tipo='whatsapp', direction='out')
-- é mais recente que next_action_at OU cujo stage não foi avançado depois
-- do último envio ficaram "prontos para disparar de novo hoje" mesmo já
-- tendo recebido a mensagem na quinta-feira.
--
-- Origem: a migration 20260732 mesclou 134 grupos transferindo as mensagens
-- do lead "perdedor" para o "vencedor", mas não recalculou stage/next_action_at
-- no vencedor. Esta migration aplica esse recálculo de forma idempotente.
-- ============================================================================

create or replace function public.cad_admin_reconcile_after_dedupe()
returns table(lead_id uuid, empresa text, old_stage public.cad_stage, new_stage public.cad_stage, new_next_action_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_new_stage public.cad_stage;
  v_next_at timestamptz;
begin
  for r in
    select l.id, l.empresa, l.stage, l.last_contact_at,
           m.stage_at_send as last_sent_stage,
           m.created_at    as last_sent_at
      from public.cad_leads l
      join lateral (
        select stage_at_send, created_at
          from public.cad_messages
         where lead_id = l.id
           and direction = 'out'
           and tipo = 'whatsapp'
         order by created_at desc
         limit 1
      ) m on true
     where l.stage not in ('fechado','perdido','interessado','reuniao_agendada',
                            'proposta_enviada','negociacao')
       and (
            -- nunca avançou o stage depois do último envio
            l.stage = m.stage_at_send
            -- ou next_action_at é anterior ao último envio (stale)
            or l.next_action_at is null
            or l.next_action_at <= m.created_at
       )
  loop
    v_new_stage := public.cad_next_stage(r.last_sent_stage);
    -- base = último envio real, mantendo a cadência por dias corridos
    v_next_at := public.cad_next_action_for_stage(v_new_stage, r.last_sent_at);

    update public.cad_leads
       set stage          = v_new_stage,
           next_action_at = v_next_at,
           last_contact_at = greatest(coalesce(last_contact_at, r.last_sent_at), r.last_sent_at)
     where id = r.id;

    lead_id := r.id;
    empresa := r.empresa;
    old_stage := r.stage;
    new_stage := v_new_stage;
    new_next_action_at := v_next_at;
    return next;
  end loop;
end $$;

grant execute on function public.cad_admin_reconcile_after_dedupe() to authenticated;

-- Executar imediatamente para corrigir o estado atual.
select * from public.cad_admin_reconcile_after_dedupe();