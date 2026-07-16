
-- 1) Trigger de defesa: colunas privadas em `prospects` NUNCA aceitam valores
--    vindos da aplicação. Elas existem por compatibilidade histórica e agora
--    são forçadas aos defaults em toda INSERT/UPDATE. O estado real por usuário
--    vive em `user_lead_state`.
CREATE OR REPLACE FUNCTION public.prospects_freeze_private_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.status           := 'nao_contatado';
  NEW.cadence_step     := 0;
  NEW.cadence_status   := 'ativo';
  NEW.response_status  := 'sem_resposta';
  NEW.last_contact_at  := NULL;
  NEW.next_contact_at  := NULL;
  NEW.closed_at        := NULL;
  NEW.closed_reason    := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prospects_freeze_private_cols ON public.prospects;
CREATE TRIGGER trg_prospects_freeze_private_cols
  BEFORE INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.prospects_freeze_private_cols();

-- 2) Reset dos dados legados que já estavam na tabela compartilhada.
--    (a view `v_prospects_with_state` já lê de user_lead_state, então isso
--    apenas garante que uma SELECT crua em `prospects` não exponha
--    resquício do trabalho de outro usuário.)
UPDATE public.prospects
   SET status          = 'nao_contatado',
       cadence_step    = 0,
       cadence_status  = 'ativo',
       response_status = 'sem_resposta',
       last_contact_at = NULL,
       next_contact_at = NULL,
       closed_at       = NULL,
       closed_reason   = NULL
 WHERE status <> 'nao_contatado'
    OR cadence_step <> 0
    OR cadence_status <> 'ativo'
    OR response_status <> 'sem_resposta'
    OR last_contact_at IS NOT NULL
    OR next_contact_at IS NOT NULL
    OR closed_at IS NOT NULL
    OR closed_reason IS NOT NULL;

-- 3) Corrige o RPC `snooze_prospect`: passa a gravar em user_lead_state
--    (estado privado do usuário logado), não mais em prospects.
CREATE OR REPLACE FUNCTION public.snooze_prospect(_prospect_id uuid, _days integer)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_org  uuid := public.current_org_id();
  v_next timestamptz;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  -- Só pode adiar leads da própria organização.
  IF NOT EXISTS (
    SELECT 1 FROM public.prospects
     WHERE id = _prospect_id AND organization_id = v_org
  ) THEN
    RAISE EXCEPTION 'prospect_not_in_org';
  END IF;

  -- Garante o registro privado do usuário para este lead.
  INSERT INTO public.user_lead_state (prospect_id, user_id, organization_id)
  VALUES (_prospect_id, v_uid, v_org)
  ON CONFLICT (prospect_id, user_id) DO NOTHING;

  v_next := COALESCE(
    (SELECT next_contact_at FROM public.user_lead_state
      WHERE prospect_id = _prospect_id AND user_id = v_uid),
    now()
  ) + (_days || ' days')::interval;

  UPDATE public.user_lead_state
     SET next_contact_at = v_next,
         cadence_status  = 'ativo',
         updated_at      = now()
   WHERE prospect_id = _prospect_id AND user_id = v_uid;

  RETURN v_next;
END $$;
