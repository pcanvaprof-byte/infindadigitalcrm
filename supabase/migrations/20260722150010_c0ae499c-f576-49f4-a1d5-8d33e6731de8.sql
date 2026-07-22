
INSERT INTO public.user_access (user_id, organization_id, status, access_type, plan_name, starts_at, expires_at, must_change_password)
SELECT om.user_id, om.organization_id, 'active', 
  CASE WHEN om.role IN ('owner','admin') THEN 'internal' ELSE 'trial' END,
  CASE WHEN om.role IN ('owner','admin') THEN 'Interno' ELSE 'Trial 30 dias' END,
  now(),
  CASE WHEN om.role IN ('owner','admin') THEN NULL ELSE now() + interval '30 days' END,
  false
FROM public.organization_members om
ON CONFLICT (user_id) DO NOTHING;
