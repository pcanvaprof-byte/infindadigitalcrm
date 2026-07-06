
GRANT EXECUTE ON FUNCTION public.cad_list_packs() TO anon;
GRANT EXECUTE ON FUNCTION public.cad_get_pack_templates(text) TO anon;
NOTIFY pgrst, 'reload schema';
