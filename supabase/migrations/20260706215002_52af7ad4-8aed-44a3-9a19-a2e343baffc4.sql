
-- Function: applies side effects when clients.pipeline_stage transitions.
CREATE OR REPLACE FUNCTION public.apply_pipeline_stage_side_effects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transition_note text;
BEGIN
  -- Only act when pipeline_stage actually changes
  IF NEW.pipeline_stage IS DISTINCT FROM OLD.pipeline_stage THEN

    IF NEW.pipeline_stage = 'PROPOSTA' THEN
      NEW.current_step := COALESCE(NEW.current_step, 'Proposta enviada — aguardando aceite');
      NEW.next_action_date := COALESCE(NEW.next_action_date, now() + INTERVAL '3 days');
      NEW.ajustes_proxima_acao := COALESCE(NEW.ajustes_proxima_acao, 'Follow-up da proposta em até 3 dias');
      NEW.ajustes_updated_at := now();

    ELSIF NEW.pipeline_stage = 'CONTRATO' THEN
      IF NEW.lc_contract_status = 'nao_gerado' THEN
        NEW.lc_contract_status := 'enviado';
      END IF;
      NEW.current_step := COALESCE(NEW.current_step, 'Contrato enviado — aguardando assinatura');
      NEW.next_action_date := COALESCE(NEW.next_action_date, now() + INTERVAL '3 days');
      NEW.ajustes_proxima_acao := COALESCE(NEW.ajustes_proxima_acao, 'Confirmar assinatura do contrato');
      NEW.ajustes_updated_at := now();

    ELSIF NEW.pipeline_stage = 'ATIVO' THEN
      NEW.activated_at := COALESCE(NEW.activated_at, now());
      NEW.operations_locked := false;
      IF NEW.lc_contract_status IN ('nao_gerado','enviado') THEN
        NEW.lc_contract_status := 'assinado';
      END IF;
      IF NEW.financial_status = 'pendente' THEN
        NEW.financial_status := 'confirmado';
      END IF;
      IF NEW.onboarding_status = 'pendente' THEN
        NEW.onboarding_status := 'em_andamento';
      END IF;
      NEW.current_step := COALESCE(NEW.current_step, 'Cliente ativo — iniciar operação');
      NEW.ajustes_proxima_acao := COALESCE(NEW.ajustes_proxima_acao, 'Kickoff da operação');
      NEW.ajustes_updated_at := now();
    END IF;

    -- Audit note into adjustment_notes (best-effort; ignore if the table is missing)
    BEGIN
      transition_note := format(
        'Estágio alterado automaticamente: %s → %s',
        COALESCE(OLD.pipeline_stage::text, '—'),
        NEW.pipeline_stage::text
      );
      INSERT INTO public.adjustment_notes (organization_id, client_id, autor_nome, nota)
      VALUES (NEW.organization_id, NEW.id, 'Sistema (pipeline)', transition_note);
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      -- silently skip if the audit table isn't available
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_pipeline_stage_side_effects ON public.clients;
CREATE TRIGGER trg_apply_pipeline_stage_side_effects
BEFORE UPDATE OF pipeline_stage ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.apply_pipeline_stage_side_effects();
