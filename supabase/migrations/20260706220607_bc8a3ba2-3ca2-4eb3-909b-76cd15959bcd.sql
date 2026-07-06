
-- 1) Extra fields on proposals (mirror of ajustes card)
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS escopo TEXT,
  ADD COLUMN IF NOT EXISTS prazo TEXT,
  ADD COLUMN IF NOT EXISTS proxima_acao TEXT,
  ADD COLUMN IF NOT EXISTS proxima_acao_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proxima_acao_responsavel TEXT;

-- 2) Notes history table
CREATE TABLE IF NOT EXISTS public.proposal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  autor_nome TEXT,
  autor_cargo TEXT,
  tipo TEXT NOT NULL DEFAULT 'nota',
  mensagem TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_notes TO authenticated;
GRANT ALL ON public.proposal_notes TO service_role;

ALTER TABLE public.proposal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_notes select same org"
  ON public.proposal_notes FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY "proposal_notes insert same org"
  ON public.proposal_notes FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "proposal_notes update owner"
  ON public.proposal_notes FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "proposal_notes delete owner"
  ON public.proposal_notes FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_proposal_notes_proposal ON public.proposal_notes(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_notes_org ON public.proposal_notes(organization_id);

CREATE TRIGGER update_proposal_notes_updated_at
  BEFORE UPDATE ON public.proposal_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
