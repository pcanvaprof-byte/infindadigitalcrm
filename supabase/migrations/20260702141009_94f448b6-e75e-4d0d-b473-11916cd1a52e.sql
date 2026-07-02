
-- RPC: lê os 13 templates de um pack (do sistema OU da org) para servir de base na duplicação.
CREATE OR REPLACE FUNCTION public.cad_get_pack_templates(_pack_key text)
RETURNS TABLE(stage public.cad_stage, titulo text, corpo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _org UUID := public.current_org_id();
BEGIN
  -- Prioriza override da org; cai para o do sistema.
  RETURN QUERY
  WITH src AS (
    SELECT t.stage, t.titulo, t.corpo,
           CASE WHEN t.organization_id = _org THEN 1 ELSE 2 END AS pr,
           row_number() OVER (PARTITION BY t.stage
             ORDER BY CASE WHEN t.organization_id = _org THEN 1 ELSE 2 END) AS rn
      FROM public.cad_templates t
     WHERE t.pack_key = _pack_key
       AND (t.is_system OR t.organization_id = _org)
  )
  SELECT src.stage, src.titulo, src.corpo FROM src WHERE rn = 1 ORDER BY src.stage;
END;
$$;

-- RPC: cria pack custom já com os 13 templates fornecidos (usado no diálogo de duplicação).
CREATE OR REPLACE FUNCTION public.cad_create_pack_with_templates(
  _pack_key text,
  _nome text,
  _descricao text,
  _categoria text,
  _icon text,
  _items jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _org UUID := public.current_org_id(); _id UUID; _it jsonb;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active org'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'templates vazios';
  END IF;

  INSERT INTO public.cad_template_packs (pack_key, nome, descricao, categoria, icon, is_system, organization_id)
  VALUES (_pack_key, _nome, NULLIF(_descricao,''), COALESCE(NULLIF(_categoria,''),'custom'), COALESCE(NULLIF(_icon,''),'Sparkles'), false, _org)
  RETURNING id INTO _id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.cad_templates (organization_id, pack_key, stage, titulo, corpo, is_system)
    VALUES (
      _org, _pack_key,
      (_it->>'stage')::public.cad_stage,
      COALESCE(_it->>'titulo',''),
      COALESCE(_it->>'corpo',''),
      false
    );
  END LOOP;

  RETURN _id;
END;
$$;

NOTIFY pgrst, 'reload schema';
