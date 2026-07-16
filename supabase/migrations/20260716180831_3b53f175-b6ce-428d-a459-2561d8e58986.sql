
-- 1) Add organization_id to prospects and backfill
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE public.prospects p
SET organization_id = uao.organization_id
FROM public.user_active_org uao
WHERE p.organization_id IS NULL AND uao.user_id = p.user_id;

UPDATE public.prospects p
SET organization_id = (SELECT id FROM public.organizations WHERE name='INFINDA' LIMIT 1)
WHERE p.organization_id IS NULL;

ALTER TABLE public.prospects ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.prospects ALTER COLUMN organization_id SET DEFAULT public.current_org_id();
CREATE INDEX IF NOT EXISTS idx_prospects_org ON public.prospects(organization_id);

-- 2) Replace prospects RLS: shared within organization
DROP POLICY IF EXISTS prospects_scope_by_role ON public.prospects;
DROP POLICY IF EXISTS prospects_org_all ON public.prospects;

CREATE POLICY prospects_org_select ON public.prospects
  FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id());

CREATE POLICY prospects_org_insert ON public.prospects
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY prospects_org_update ON public.prospects
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY prospects_org_delete ON public.prospects
  FOR DELETE TO authenticated
  USING (organization_id = public.current_org_id()
         AND (user_id = auth.uid() OR public.current_org_role() IN ('owner','admin')));

-- 3) user_lead_state: per-user private state
CREATE TABLE IF NOT EXISTS public.user_lead_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.current_org_id(),
  status text NOT NULL DEFAULT 'nao_contatado',
  cadence_step smallint NOT NULL DEFAULT 0,
  cadence_status text NOT NULL DEFAULT 'ativo',
  response_status text NOT NULL DEFAULT 'sem_resposta',
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  closed_reason text,
  closed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lead_state TO authenticated;
GRANT ALL ON public.user_lead_state TO service_role;

ALTER TABLE public.user_lead_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY uls_own_select ON public.user_lead_state
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY uls_own_insert ON public.user_lead_state
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND organization_id = public.current_org_id());
CREATE POLICY uls_own_update ON public.user_lead_state
  FOR UPDATE TO authenticated USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY uls_own_delete ON public.user_lead_state
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS uls_user_next_idx ON public.user_lead_state(user_id, next_contact_at);
CREATE INDEX IF NOT EXISTS uls_user_status_idx ON public.user_lead_state(user_id, status);
CREATE INDEX IF NOT EXISTS uls_prospect_idx ON public.user_lead_state(prospect_id);

CREATE OR REPLACE FUNCTION public.uls_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_uls_updated_at ON public.user_lead_state;
CREATE TRIGGER trg_uls_updated_at BEFORE UPDATE ON public.user_lead_state
  FOR EACH ROW EXECUTE FUNCTION public.uls_touch_updated_at();

-- 4) Lazy-create RPC
CREATE OR REPLACE FUNCTION public.get_or_create_lead_state(_prospect uuid)
RETURNS public.user_lead_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_org uuid := public.current_org_id(); v_row public.user_lead_state;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_row FROM public.user_lead_state WHERE prospect_id = _prospect AND user_id = v_uid;
  IF FOUND THEN RETURN v_row; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prospects WHERE id = _prospect AND organization_id = v_org) THEN
    RAISE EXCEPTION 'prospect_not_in_org';
  END IF;
  INSERT INTO public.user_lead_state (prospect_id, user_id, organization_id)
    VALUES (_prospect, v_uid, v_org)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

GRANT EXECUTE ON FUNCTION public.get_or_create_lead_state(uuid) TO authenticated;

-- 5) View that merges prospect + current user's private state
CREATE OR REPLACE VIEW public.v_prospects_with_state
WITH (security_invoker = on) AS
SELECT
  p.id, p.organization_id, p.user_id AS created_by, p.company, p.cnpj, p.segment,
  p.owner_name, p.whatsapp, p.phone, p.email, p.instagram, p.city, p.state,
  p.source, p.potential, p.created_at, p.updated_at,
  COALESCE(s.status, 'nao_contatado') AS status,
  COALESCE(s.cadence_step, 0) AS cadence_step,
  COALESCE(s.cadence_status, 'ativo') AS cadence_status,
  COALESCE(s.response_status, 'sem_resposta') AS response_status,
  s.last_contact_at, s.next_contact_at, s.closed_reason, s.closed_at, s.notes AS private_notes,
  s.id AS state_id
FROM public.prospects p
LEFT JOIN public.user_lead_state s
  ON s.prospect_id = p.id AND s.user_id = auth.uid();

GRANT SELECT ON public.v_prospects_with_state TO authenticated;

-- 6) Restrict updates on shared prospects columns: revoke UPDATE on private legacy columns
-- (keep base columns writable via UPDATE; private state should go to user_lead_state now)
-- Application code is responsible for routing writes.

-- 7) Touchpoints/interactions: ensure per-user privacy (already user_id scoped). Add org check for safety.
-- prospect_touchpoints already has user_id. Ensure SELECT is only own.
DROP POLICY IF EXISTS pt_org_all ON public.prospect_touchpoints;
