-- ============================================================
-- API Keys para acesso externo (Claude / n8n / agentes)
-- ============================================================

CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_org ON public.api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org api keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (public.is_member_of_org(organization_id));

CREATE POLICY "Members can create api keys for their org"
  ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (
    public.is_member_of_org(organization_id)
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can revoke their own keys; admins revoke any"
  ON public.api_keys FOR UPDATE TO authenticated
  USING (
    public.is_member_of_org(organization_id)
    AND (created_by = auth.uid() OR public.is_org_admin(organization_id))
  )
  WITH CHECK (public.is_member_of_org(organization_id));

CREATE POLICY "Admins can delete api keys"
  ON public.api_keys FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

CREATE TRIGGER trg_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Audit log
-- ============================================================

CREATE TABLE public.api_key_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status INT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_key_audit_key ON public.api_key_audit_log(api_key_id, created_at DESC);
CREATE INDEX idx_api_key_audit_org ON public.api_key_audit_log(organization_id, created_at DESC);

GRANT SELECT ON public.api_key_audit_log TO authenticated;
GRANT ALL ON public.api_key_audit_log TO service_role;

ALTER TABLE public.api_key_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org api audit"
  ON public.api_key_audit_log FOR SELECT TO authenticated
  USING (public.is_member_of_org(organization_id));