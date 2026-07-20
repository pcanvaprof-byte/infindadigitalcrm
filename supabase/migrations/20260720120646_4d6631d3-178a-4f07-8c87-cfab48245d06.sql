
CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  description text,
  product text,
  ideal_customer text,
  region text,
  differentials text,
  niche text,
  audience text,
  language text,
  tone text,
  focus text,
  pains text[] NOT NULL DEFAULT '{}',
  benefits text[] NOT NULL DEFAULT '{}',
  triggers text[] NOT NULL DEFAULT '{}',
  approach text,
  initial_message text,
  onboarding_status text NOT NULL DEFAULT 'draft' CHECK (onboarding_status IN ('draft','completed')),
  ai_model text,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bp_select_org" ON public.business_profiles;
CREATE POLICY "bp_select_org" ON public.business_profiles
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS "bp_insert_org" ON public.business_profiles;
CREATE POLICY "bp_insert_org" ON public.business_profiles
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS "bp_update_org" ON public.business_profiles;
CREATE POLICY "bp_update_org" ON public.business_profiles
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

CREATE OR REPLACE FUNCTION public.tg_business_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bp_updated ON public.business_profiles;
CREATE TRIGGER trg_bp_updated
  BEFORE UPDATE ON public.business_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_business_profiles_updated_at();

CREATE INDEX IF NOT EXISTS idx_business_profiles_org ON public.business_profiles(org_id);
