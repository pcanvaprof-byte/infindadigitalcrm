-- Unificação: Nicho vira Pack de Cadência completo.
-- Cada nicho passa a ter seu próprio pack por organização (pack_key = 'niche_<key>').
-- O pack herda automaticamente do 'default' quando o usuário não sobrescreve um estágio.

ALTER TABLE public.cad_template_packs
  ADD COLUMN IF NOT EXISTS niche_key text;

COMMENT ON COLUMN public.cad_template_packs.niche_key IS
  'Chave do nicho (NicheKey em src/lib/prospeccao/niche-templates.ts). Quando preenchido, este pack é o pack de cadência do nicho, editado em /cadencia > Templates.';

CREATE UNIQUE INDEX IF NOT EXISTS cad_template_packs_org_niche_uq
  ON public.cad_template_packs (organization_id, niche_key)
  WHERE niche_key IS NOT NULL;

-- ─── RPC: retorna os 7 estágios de followup de um nicho, mesclando override da org com o fallback do pack default do sistema.
CREATE OR REPLACE FUNCTION public.cad_niche_pack_stages(_niche_key text)
RETURNS TABLE(stage public.cad_stage, titulo text, corpo text, is_override boolean, version int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org uuid := public.current_org_id();
  _pack text := 'niche_' || _niche_key;
BEGIN
  IF _org IS NULL THEN
    RAISE EXCEPTION 'no active organization';
  END IF;
  IF _niche_key !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'invalid niche_key';
  END IF;

  RETURN QUERY
  WITH stages AS (
    SELECT unnest(ARRAY[
      'followup_1','followup_2','followup_3','followup_4',
      'followup_5','followup_6','followup_7'
    ]::public.cad_stage[]) AS s
  ),
  own AS (
    SELECT t.stage, t.titulo, t.corpo
      FROM public.cad_templates t
     WHERE t.organization_id = _org AND t.pack_key = _pack
  ),
  fallback AS (
    SELECT t.stage, t.titulo, t.corpo
      FROM public.cad_templates t
     WHERE t.is_system AND t.pack_key = 'default'
  )
  SELECT s.s AS stage,
         COALESCE(o.titulo, f.titulo, 'Mensagem — ' || s.s::text) AS titulo,
         COALESCE(o.corpo,  f.corpo,  '') AS corpo,
         (o.stage IS NOT NULL) AS is_override,
         1::int AS version
    FROM stages s
    LEFT JOIN own      o ON o.stage = s.s
    LEFT JOIN fallback f ON f.stage = s.s
    ORDER BY s.s;
END;
$$;

-- ─── RPC: salva/atualiza uma etapa do pack do nicho para a org ativa.
CREATE OR REPLACE FUNCTION public.cad_niche_pack_upsert(
  _niche_key text,
  _stage public.cad_stage,
  _titulo text,
  _corpo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org  uuid := public.current_org_id();
  _pack text := 'niche_' || _niche_key;
  _id   uuid;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active organization'; END IF;
  IF _niche_key !~ '^[a-z0-9_]+$' THEN RAISE EXCEPTION 'invalid niche_key'; END IF;

  -- Garante pack da org (criado sob demanda no primeiro save).
  INSERT INTO public.cad_template_packs
    (pack_key, nome, descricao, categoria, is_system, organization_id, niche_key)
  VALUES
    (_pack, _niche_key, 'Pack de cadência do nicho ' || _niche_key,
     'nicho', false, _org, _niche_key)
  ON CONFLICT (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), pack_key)
  DO NOTHING;

  INSERT INTO public.cad_templates
    (organization_id, pack_key, stage, titulo, corpo, is_system)
  VALUES
    (_org, _pack, _stage, _titulo, _corpo, false)
  ON CONFLICT (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), pack_key, stage)
  DO UPDATE SET titulo = EXCLUDED.titulo, corpo = EXCLUDED.corpo, updated_at = now()
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- ─── RPC: reseta (remove overrides) — se _stage for NULL, reseta todo o pack do nicho.
CREATE OR REPLACE FUNCTION public.cad_niche_pack_reset(
  _niche_key text,
  _stage public.cad_stage DEFAULT NULL
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org  uuid := public.current_org_id();
  _pack text := 'niche_' || _niche_key;
  _n    int;
BEGIN
  IF _org IS NULL THEN RAISE EXCEPTION 'no active organization'; END IF;
  IF _stage IS NULL THEN
    DELETE FROM public.cad_templates
     WHERE organization_id = _org AND pack_key = _pack;
  ELSE
    DELETE FROM public.cad_templates
     WHERE organization_id = _org AND pack_key = _pack AND stage = _stage;
  END IF;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

-- ─── RPC: lista quais nichos já têm override na org ativa (pra badge "editado").
CREATE OR REPLACE FUNCTION public.cad_niche_pack_edited_keys()
RETURNS TABLE(niche_key text, stages_edited int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    substring(t.pack_key from 7) AS niche_key,
    count(*)::int AS stages_edited
  FROM public.cad_templates t
  WHERE t.organization_id = public.current_org_id()
    AND t.pack_key LIKE 'niche\_%' ESCAPE '\'
  GROUP BY 1
$$;

GRANT EXECUTE ON FUNCTION public.cad_niche_pack_stages(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_niche_pack_upsert(text, public.cad_stage, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_niche_pack_reset(text, public.cad_stage) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cad_niche_pack_edited_keys() TO authenticated;