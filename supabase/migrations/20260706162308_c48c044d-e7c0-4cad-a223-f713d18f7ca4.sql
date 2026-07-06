
-- Recarrega o cache de schema do PostgREST para expor cad_list_packs e demais RPCs
NOTIFY pgrst, 'reload schema';

-- Garante GRANT EXECUTE nas RPCs usadas pela Biblioteca de Cadências
GRANT EXECUTE ON FUNCTION public.cad_list_packs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_get_pack_templates(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_toggle_favorite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_apply_pack(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_delete_pack(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_update_pack_meta(text, text, text, text, text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_create_custom_pack(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_create_pack_with_templates(text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_upsert_template(text, public.cad_stage, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_set_default_seed_pack(text) TO authenticated;

-- Backfill: garante que todo usuário existente tenha organização INFINDA associada
DO $$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE name = 'INFINDA' LIMIT 1;
  IF v_org IS NULL THEN
    INSERT INTO public.organizations(name, slug) VALUES ('INFINDA', 'infinda') RETURNING id INTO v_org;
  END IF;

  INSERT INTO public.organization_members(organization_id, user_id, role)
  SELECT v_org, u.id, 'member'
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.user_id = u.id
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_active_org(user_id, organization_id)
  SELECT u.id, v_org
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_active_org a WHERE a.user_id = u.id
  )
  ON CONFLICT DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
