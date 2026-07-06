ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ajustes_escopo text,
  ADD COLUMN IF NOT EXISTS ajustes_prazo date,
  ADD COLUMN IF NOT EXISTS ajustes_proxima_acao text,
  ADD COLUMN IF NOT EXISTS ajustes_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.adjustment_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nota text NOT NULL,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adj_notes_client ON public.adjustment_notes(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_adj_notes_org    ON public.adjustment_notes(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adjustment_notes TO authenticated;
GRANT ALL ON public.adjustment_notes TO service_role;

ALTER TABLE public.adjustment_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.adjustment_notes;
CREATE POLICY tenant_isolation_restrictive ON public.adjustment_notes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "org members manage adjustment notes" ON public.adjustment_notes;
CREATE POLICY "org members manage adjustment notes" ON public.adjustment_notes
  FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());