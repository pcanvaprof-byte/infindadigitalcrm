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
DECLARE
  _stages public.cad_stage[] := ARRAY[
    'followup_1','followup_2','followup_3','followup_4',
    'followup_5','followup_6','followup_7',
    'interessado','reuniao_agendada','proposta_enviada',
    'negociacao','fechado','perdido'
  ]::public.cad_stage[];
  _s public.cad_stage;
BEGIN
  FOREACH _s IN ARRAY _stages LOOP
    RETURN QUERY
    WITH r AS (
      SELECT * FROM public.cad_resolve_template(p_organization_id, p_owner_id, p_pack_key, _s)
    ),
    ov AS (
      SELECT t.id
        FROM public.cad_templates t
       WHERE t.organization_id = p_organization_id
         AND t.owner_id = p_owner_id
         AND t.pack_key = p_pack_key
         AND t.stage = _s
       LIMIT 1
    )
    SELECT _s AS stage, r.titulo, r.corpo, r.source, ov.id AS override_id
      FROM r LEFT JOIN ov ON true;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cad_list_resolved_templates(uuid, uuid, text) TO authenticated;