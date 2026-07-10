
DROP POLICY IF EXISTS "tmemb_write" ON public.team_members;

CREATE POLICY "tmemb_write_admin" ON public.team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND t.organization_id = public.current_org_id()
      AND public.is_org_admin(t.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id
      AND t.organization_id = public.current_org_id()
      AND public.is_org_admin(t.organization_id)
  )
);
