-- ============================================================
-- BRIEFINGS: add organization_id + tenant restrictive policy
-- ============================================================
ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

UPDATE public.briefings
   SET organization_id = 'f7bde4c5-4c5f-4072-9b31-abb6a7c00b9f'
 WHERE organization_id IS NULL;

ALTER TABLE public.briefings
  ALTER COLUMN organization_id SET DEFAULT public.current_org_id();

CREATE INDEX IF NOT EXISTS idx_briefings_org ON public.briefings(organization_id);

-- Restrictive tenant isolation for signed-in users only.
-- Public token access uses SECURITY DEFINER functions (get/update_briefing_by_token)
-- which run as function owner and bypass RLS — public flow unaffected.
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.briefings;
CREATE POLICY tenant_isolation_restrictive ON public.briefings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id IS NULL OR organization_id = public.current_org_id())
  WITH CHECK (organization_id IS NULL OR organization_id = public.current_org_id());

-- ============================================================
-- PROPOSALS: restrictive tenant policy (column already exists)
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.proposals;
CREATE POLICY tenant_isolation_restrictive ON public.proposals
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- ============================================================
-- CONTRATOS: restrictive tenant policy (column already exists)
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.contratos;
CREATE POLICY tenant_isolation_restrictive ON public.contratos
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- ============================================================
-- CLIENT_EVENTS: restrictive tenant policy
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.client_events;
CREATE POLICY tenant_isolation_restrictive ON public.client_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

-- ============================================================
-- Proposal child tables — inherit org via proposal_id
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.proposal_items;
CREATE POLICY tenant_isolation_restrictive ON public.proposal_items
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p
                  WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p
                       WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()));

DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.proposal_adjustments;
CREATE POLICY tenant_isolation_restrictive ON public.proposal_adjustments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p
                  WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p
                       WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()));

DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.proposal_events;
CREATE POLICY tenant_isolation_restrictive ON public.proposal_events
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p
                  WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p
                       WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()));

DROP POLICY IF EXISTS tenant_isolation_restrictive ON public.proposal_versions;
CREATE POLICY tenant_isolation_restrictive ON public.proposal_versions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p
                  WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.proposals p
                       WHERE p.id = proposal_id AND p.organization_id = public.current_org_id()));
