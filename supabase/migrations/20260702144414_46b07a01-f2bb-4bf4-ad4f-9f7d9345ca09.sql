
GRANT SELECT ON public.cad_template_packs TO authenticated, anon;
GRANT SELECT ON public.cad_templates TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.cad_template_packs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cad_templates TO authenticated;
GRANT ALL ON public.cad_template_packs TO service_role;
GRANT ALL ON public.cad_templates TO service_role;
NOTIFY pgrst, 'reload schema';
