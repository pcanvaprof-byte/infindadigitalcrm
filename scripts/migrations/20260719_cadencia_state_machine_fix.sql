-- ============================================================================
-- Cadência — máquina de estados (Opção A)
--
-- Decisão final: o estado 'novo' foi removido. Leads importados nascem
-- diretamente em 'followup_1' (próxima etapa a executar). A semântica do
-- campo `stage` é "PRÓXIMA etapa a enviar".
--
-- Esta migration mantém apenas o helper `cad_stage_to_send` alinhado a essa
-- decisão. As funções `cad_register_send` e `cad_import_from_prospects`
-- são (re)definidas em 20260720_cadencia_eligibility_lock.sql.
-- ============================================================================

-- Helper: próxima etapa a ENVIAR a partir do stage atual.
create or replace function public.cad_stage_to_send(p_current public.cad_stage)
returns public.cad_stage language sql immutable as $$
  select case p_current
    when 'followup_1' then 'followup_1'::public.cad_stage
    when 'followup_2' then 'followup_2'::public.cad_stage
    when 'followup_3' then 'followup_3'::public.cad_stage
    when 'followup_4' then 'followup_4'::public.cad_stage
    when 'followup_5' then 'followup_5'::public.cad_stage
    when 'followup_6' then 'followup_6'::public.cad_stage
    when 'followup_7' then 'followup_7'::public.cad_stage
    else p_current
  end
$$;
