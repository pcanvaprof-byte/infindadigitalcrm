
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS default_seed_pack text DEFAULT 'wa_padrao';

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
DECLARE _org UUID := public.current_org_id(); _id UUID; _seed TEXT;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active org'; END IF;

  INSERT INTO public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system, organization_id)
  VALUES (_pack_key, _nome, _descricao, _categoria, _icon, false, _org)
  RETURNING id INTO _id;

  SELECT default_seed_pack INTO _seed FROM public.organizations WHERE id = _org;

  IF _seed IS NOT NULL AND _seed <> '' THEN
    INSERT INTO public.cad_templates (organization_id, pack_key, stage, titulo, corpo, is_system)
    SELECT _org, _pack_key, t.stage, t.titulo, t.corpo, false
      FROM public.cad_templates t
     WHERE t.pack_key = _seed AND t.is_system = true AND t.organization_id IS NULL;
  END IF;

  RETURN _id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cad_get_default_seed_pack()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT default_seed_pack FROM public.organizations WHERE id = public.current_org_id()
$$;

CREATE OR REPLACE FUNCTION public.cad_set_default_seed_pack(_pack_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _org UUID := public.current_org_id();
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active org'; END IF;
  IF _pack_key IS NOT NULL AND _pack_key <> '' AND NOT EXISTS (
    SELECT 1 FROM public.cad_template_packs
    WHERE pack_key = _pack_key AND (is_system OR organization_id = _org)
  ) THEN
    RAISE EXCEPTION 'pack not found: %', _pack_key;
  END IF;
  UPDATE public.organizations
     SET default_seed_pack = NULLIF(_pack_key, '')
   WHERE id = _org;
  RETURN true;
END;
$$;

NOTIFY pgrst, 'reload schema';
