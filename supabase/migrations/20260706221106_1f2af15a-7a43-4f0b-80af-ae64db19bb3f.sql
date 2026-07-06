
CREATE TABLE IF NOT EXISTS public.billing_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.current_org_id(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  nome TEXT NOT NULL,
  site_descricao TEXT NOT NULL DEFAULT 'Site',
  site_valor NUMERIC NOT NULL DEFAULT 0,
  site_parcelas INTEGER NOT NULL DEFAULT 1,
  site_intervalo_dias INTEGER NOT NULL DEFAULT 30,
  mentoria_descricao TEXT NOT NULL DEFAULT 'Mentoria',
  mentoria_valor NUMERIC NOT NULL DEFAULT 0,
  mentoria_meses INTEGER NOT NULL DEFAULT 1,
  mentoria_bonif INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_presets TO authenticated;
GRANT ALL ON public.billing_presets TO service_role;

ALTER TABLE public.billing_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_presets select own"
  ON public.billing_presets FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "billing_presets insert own"
  ON public.billing_presets FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "billing_presets update own"
  ON public.billing_presets FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "billing_presets delete own"
  ON public.billing_presets FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_billing_presets_owner ON public.billing_presets(organization_id, user_id);

CREATE TRIGGER trg_billing_presets_updated
  BEFORE UPDATE ON public.billing_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
