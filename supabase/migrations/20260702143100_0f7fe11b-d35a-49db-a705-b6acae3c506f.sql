GRANT EXECUTE ON FUNCTION public.cad_list_packs() TO authenticator;
GRANT EXECUTE ON FUNCTION public.cad_apply_pack(text) TO authenticator;
GRANT EXECUTE ON FUNCTION public.cad_get_default_seed_pack() TO authenticator;
GRANT EXECUTE ON FUNCTION public.cad_set_default_seed_pack(text) TO authenticator;
GRANT EXECUTE ON FUNCTION public.cad_get_pack_templates(text) TO authenticator;
GRANT EXECUTE ON FUNCTION public.cad_create_pack_with_templates(text, text, text, text, text, jsonb) TO authenticator;

NOTIFY pgrst, 'reload schema';