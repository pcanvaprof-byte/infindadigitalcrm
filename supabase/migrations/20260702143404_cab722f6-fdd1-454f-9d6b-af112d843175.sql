GRANT UPDATE (active_template_pack, default_seed_pack) ON public.organizations TO authenticated;

DROP POLICY IF EXISTS orgs_member_update_template_pack_settings ON public.organizations;
CREATE POLICY orgs_member_update_template_pack_settings
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.is_member_of_org(id))
WITH CHECK (public.is_member_of_org(id));