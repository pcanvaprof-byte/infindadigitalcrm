BEGIN;

CREATE OR REPLACE FUNCTION public._is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_org_role() IN ('owner','admin'), false)
$$;

REVOKE ALL ON FUNCTION public._is_org_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._is_org_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cad_is_org_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._is_org_admin()
$$;

REVOKE ALL ON FUNCTION public.cad_is_org_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cad_is_org_admin() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;