-- Padroniza EXECUTE dos helpers de papel: nada para PUBLIC/anon.
REVOKE ALL ON FUNCTION public._is_org_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cad_is_org_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_org_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cad_is_org_admin() TO authenticated, service_role;
