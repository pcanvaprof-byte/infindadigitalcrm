
CREATE OR REPLACE FUNCTION public.cad_create_custom_pack(
  _pack_key text,
  _nome text,
  _descricao text DEFAULT NULL,
  _categoria text DEFAULT 'custom',
  _icon text DEFAULT 'Sparkles'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _org UUID := public.current_org_id(); _id UUID;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active org'; END IF;
  INSERT INTO public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system, organization_id)
  VALUES (_pack_key, _nome, _descricao, _categoria, _icon, false, _org)
  RETURNING id INTO _id;

  -- Semeia com o pack "WhatsApp Padrão" como modelo pronto e editável.
  INSERT INTO public.cad_templates (organization_id, pack_key, stage, titulo, corpo, is_system)
  SELECT _org, _pack_key, t.stage, t.titulo, t.corpo, false
    FROM public.cad_templates t
   WHERE t.pack_key = 'wa_padrao' AND t.is_system = true AND t.organization_id IS NULL;

  RETURN _id;
END;
$function$;

NOTIFY pgrst, 'reload schema';
