
CREATE TABLE public.org_switch_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  previous_org_id UUID,
  new_org_id UUID NOT NULL,
  reason TEXT NOT NULL,
  previous_score NUMERIC,
  new_score NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX org_switch_audit_user_idx ON public.org_switch_audit (user_id, created_at DESC);
CREATE INDEX org_switch_audit_new_org_idx ON public.org_switch_audit (new_org_id, created_at DESC);

GRANT SELECT ON public.org_switch_audit TO authenticated;
GRANT ALL ON public.org_switch_audit TO service_role;

ALTER TABLE public.org_switch_audit ENABLE ROW LEVEL SECURITY;

-- O próprio usuário pode ver suas trocas
CREATE POLICY "user_can_read_own_org_switch_audit"
  ON public.org_switch_audit
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owner/Admin da org nova pode auditar trocas para essa org
CREATE POLICY "org_admins_can_read_org_switch_audit"
  ON public.org_switch_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = org_switch_audit.new_org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );
