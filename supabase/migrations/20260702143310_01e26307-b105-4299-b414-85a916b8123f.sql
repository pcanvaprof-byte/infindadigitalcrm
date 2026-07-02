REVOKE EXECUTE ON FUNCTION public.cad_list_packs() FROM authenticator;
REVOKE EXECUTE ON FUNCTION public.cad_apply_pack(text) FROM authenticator;
REVOKE EXECUTE ON FUNCTION public.cad_get_default_seed_pack() FROM authenticator;
REVOKE EXECUTE ON FUNCTION public.cad_set_default_seed_pack(text) FROM authenticator;
REVOKE EXECUTE ON FUNCTION public.cad_get_pack_templates(text) FROM authenticator;
REVOKE EXECUTE ON FUNCTION public.cad_create_pack_with_templates(text, text, text, text, text, jsonb) FROM authenticator;

NOTIFY pgrst, 'reload schema';