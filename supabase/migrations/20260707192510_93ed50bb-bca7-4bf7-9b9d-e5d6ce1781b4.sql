DROP POLICY IF EXISTS "deal_stages public read" ON public.deal_stages;

CREATE POLICY "deal_stages org read"
  ON public.deal_stages
  FOR SELECT
  TO authenticated
  USING (organization_id = public.current_org_id());

REVOKE SELECT ON public.deal_stages FROM anon;