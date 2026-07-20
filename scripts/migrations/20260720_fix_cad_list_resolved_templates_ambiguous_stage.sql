-- ============================================================
-- Correção: cad_list_resolved_templates sem ambiguidade em stage
-- Projeto real: oxmhwwopxurwqcrwgsyf
-- Executar no SQL Editor do Supabase externo, se a RPC ainda for usada.
-- A aplicação também foi ajustada para resolver templates direto na tabela.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cad_list_resolved_templates(
  p_organization_id uuid,
  p_owner_id        uuid,
  p_pack_key        text
)
RETURNS TABLE(
  stage       public.cad_stage,
  titulo      text,
  corpo       text,
  source      text,
  override_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stage_list(stage_value, stage_order) AS (
    VALUES
      ('followup_1'::public.cad_stage, 1),
      ('followup_2'::public.cad_stage, 2),
      ('followup_3'::public.cad_stage, 3),
      ('followup_4'::public.cad_stage, 4),
      ('followup_5'::public.cad_stage, 5),
      ('followup_6'::public.cad_stage, 6),
      ('followup_7'::public.cad_stage, 7),
      ('interessado'::public.cad_stage, 8),
      ('reuniao_agendada'::public.cad_stage, 9),
      ('proposta_enviada'::public.cad_stage, 10),
      ('negociacao'::public.cad_stage, 11),
      ('fechado'::public.cad_stage, 12),
      ('perdido'::public.cad_stage, 13)
  ),
  candidates AS (
    SELECT
      sl.stage_value,
      sl.stage_order,
      t.id,
      t.titulo,
      t.corpo,
      CASE
        WHEN t.organization_id = p_organization_id AND t.owner_id = p_owner_id THEN 'user'::text
        WHEN t.organization_id = p_organization_id AND t.owner_id IS NULL THEN 'org'::text
        ELSE 'system'::text
      END AS resolved_source,
      row_number() OVER (
        PARTITION BY sl.stage_value
        ORDER BY
          CASE WHEN t.pack_key = p_pack_key THEN 0 WHEN t.pack_key = 'default' THEN 10 ELSE 20 END,
          CASE
            WHEN t.organization_id = p_organization_id AND t.owner_id = p_owner_id THEN 0
            WHEN t.organization_id = p_organization_id AND t.owner_id IS NULL THEN 1
            WHEN t.is_system THEN 2
            ELSE 9
          END
      ) AS rn
    FROM stage_list sl
    JOIN public.cad_templates t
      ON t.stage = sl.stage_value
     AND t.pack_key IN (p_pack_key, 'default')
     AND (
       (t.organization_id = p_organization_id AND (t.owner_id IS NULL OR t.owner_id = p_owner_id))
       OR t.is_system
     )
  ),
  overrides AS (
    SELECT t.stage AS override_stage, t.id AS override_id
      FROM public.cad_templates t
     WHERE t.organization_id = p_organization_id
       AND t.owner_id = p_owner_id
       AND t.pack_key = p_pack_key
  )
  SELECT c.stage_value, c.titulo, c.corpo, c.resolved_source, o.override_id
    FROM candidates c
    LEFT JOIN overrides o ON o.override_stage = c.stage_value
   WHERE c.rn = 1
   ORDER BY c.stage_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cad_list_resolved_templates(uuid, uuid, text) TO authenticated;