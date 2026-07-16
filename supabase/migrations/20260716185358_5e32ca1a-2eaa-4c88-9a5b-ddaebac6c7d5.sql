GRANT SELECT ON public.v_prospects_user TO authenticated;
GRANT SELECT ON public.v_prospects_user TO anon;
GRANT ALL ON public.v_prospects_user TO service_role;
NOTIFY pgrst, 'reload schema';