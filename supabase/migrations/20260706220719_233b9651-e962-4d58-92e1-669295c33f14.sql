
-- Link columns to prevent duplicate/loop syncing
ALTER TABLE public.adjustment_notes
  ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS synced_adjustment_id UUID REFERENCES public.proposal_adjustments(id) ON DELETE SET NULL;

ALTER TABLE public.proposal_adjustments
  ADD COLUMN IF NOT EXISTS synced_note_id UUID REFERENCES public.adjustment_notes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_adj_notes_synced ON public.adjustment_notes(synced_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_prop_adj_synced ON public.proposal_adjustments(synced_note_id);

-- Trigger: client note -> propagate to all open proposals for that client
CREATE OR REPLACE FUNCTION public.sync_client_note_to_proposals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD; v_new_adj UUID;
BEGIN
  -- Skip if this note was itself created by a proposal->client sync
  IF NEW.synced_adjustment_id IS NOT NULL THEN RETURN NEW; END IF;

  FOR p IN
    SELECT id FROM public.proposals
     WHERE client_id = NEW.client_id
       AND status::text NOT IN ('cancelada','recusada','expirada','convertida')
  LOOP
    INSERT INTO public.proposal_adjustments
      (proposal_id, origem, autor_nome, mensagem, status, synced_note_id)
    VALUES
      (p.id, 'cliente_cadastro', NEW.autor_nome, NEW.nota, 'aberto', NEW.id)
    RETURNING id INTO v_new_adj;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_client_note_to_proposals ON public.adjustment_notes;
CREATE TRIGGER trg_sync_client_note_to_proposals
  AFTER INSERT ON public.adjustment_notes
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_note_to_proposals();

-- Trigger: proposal adjustment -> propagate to client cadastro
CREATE OR REPLACE FUNCTION public.sync_proposal_adjustment_to_client()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client UUID; v_org UUID; v_user UUID; v_note UUID;
BEGIN
  -- Skip if already a mirror of a client note
  IF NEW.synced_note_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT client_id, organization_id, user_id
    INTO v_client, v_org, v_user
    FROM public.proposals WHERE id = NEW.proposal_id;

  IF v_client IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.adjustment_notes
    (organization_id, user_id, client_id, nota, autor_nome, proposal_id, synced_adjustment_id)
  VALUES
    (v_org, v_user, v_client,
     '[Proposta] ' || NEW.mensagem,
     NEW.autor_nome, NEW.proposal_id, NEW.id)
  RETURNING id INTO v_note;

  UPDATE public.proposal_adjustments SET synced_note_id = v_note WHERE id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_proposal_adjustment_to_client ON public.proposal_adjustments;
CREATE TRIGGER trg_sync_proposal_adjustment_to_client
  AFTER INSERT ON public.proposal_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.sync_proposal_adjustment_to_client();

-- Keep status/resolution in sync when the mirrored side is updated
CREATE OR REPLACE FUNCTION public.sync_proposal_adjustment_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.synced_note_id IS NULL THEN
    -- Nothing to propagate for client-cadastro notes without a status column
    NULL;
  END IF;
  RETURN NEW;
END $$;
