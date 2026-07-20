-- ============================================================
-- Overrides de templates por member
-- Projeto: oxmhwwopxurwqcrwgsyf
-- Executar no SQL Editor do Supabase externo.
-- ============================================================

-- 1. Nova coluna: owner_id (NULL = padrão da organização)
ALTER TABLE public.cad_templates
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Índices
DROP INDEX IF EXISTS public.cad_templates_org_pack_stage_uk;
CREATE UNIQUE INDEX IF NOT EXISTS cad_templates_org_owner_pack_stage_uk
  ON public.cad_templates (
    COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(owner_id,        '00000000-0000-0000-0000-000000000000'::uuid),
    pack_key,
    stage
  );
CREATE INDEX IF NOT EXISTS cad_templates_resolve_idx
  ON public.cad_templates (organization_id, pack_key, stage, owner_id);

-- 3. RLS — recria com consciência de owner_id
ALTER TABLE public.cad_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cad_templates_read   ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_select ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_write  ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_own_ins ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_own_upd ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_own_del ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_org_ins ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_org_upd ON public.cad_templates;
DROP POLICY IF EXISTS cad_templates_org_del ON public.cad_templates;

-- SELECT: sistema OR (org corrente E (padrão da org OU meu override))
CREATE POLICY cad_templates_read ON public.cad_templates
  FOR SELECT TO authenticated
  USING (
    is_system
    OR (
      organization_id = public.current_org_id()
      AND (owner_id IS NULL OR owner_id = auth.uid())
    )
  );

-- Overrides do próprio member (INSERT/UPDATE/DELETE)
CREATE POLICY cad_templates_own_ins ON public.cad_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND owner_id = auth.uid()
    AND NOT is_system
  );
CREATE POLICY cad_templates_own_upd ON public.cad_templates
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND owner_id = auth.uid()
    AND NOT is_system
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND owner_id = auth.uid()
    AND NOT is_system
  );
CREATE POLICY cad_templates_own_del ON public.cad_templates
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND owner_id = auth.uid()
    AND NOT is_system
  );

-- Padrão da organização (owner_id IS NULL) editável apenas por owner/admin
CREATE POLICY cad_templates_org_ins ON public.cad_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_org_id()
    AND owner_id IS NULL
    AND NOT is_system
    AND public.is_org_admin(public.current_org_id())
  );
CREATE POLICY cad_templates_org_upd ON public.cad_templates
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND owner_id IS NULL
    AND NOT is_system
    AND public.is_org_admin(public.current_org_id())
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND owner_id IS NULL
    AND NOT is_system
    AND public.is_org_admin(public.current_org_id())
  );
CREATE POLICY cad_templates_org_del ON public.cad_templates
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND owner_id IS NULL
    AND NOT is_system
    AND public.is_org_admin(public.current_org_id())
  );

-- 4. RPC: cad_resolve_template — recebe todos os parâmetros explicitamente,
-- não usa auth.uid() internamente. Overload da função de 1 argumento existente.
CREATE OR REPLACE FUNCTION public.cad_resolve_template(
  p_organization_id uuid,
  p_owner_id        uuid,
  p_pack_key        text,
  p_stage           public.cad_stage
)
RETURNS TABLE(titulo text, corpo text, pack_key text, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1) Override do usuário
  IF p_owner_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.titulo, t.corpo, t.pack_key, 'user'::text
      FROM public.cad_templates t
     WHERE t.organization_id = p_organization_id
       AND t.owner_id = p_owner_id
       AND t.pack_key = p_pack_key
       AND t.stage = p_stage
     LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 2) Padrão da organização
  RETURN QUERY
  SELECT t.titulo, t.corpo, t.pack_key, 'org'::text
    FROM public.cad_templates t
   WHERE t.organization_id = p_organization_id
     AND t.owner_id IS NULL
     AND t.pack_key = p_pack_key
     AND t.stage = p_stage
   LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 3) Sistema (global)
  RETURN QUERY
  SELECT t.titulo, t.corpo, t.pack_key, 'system'::text
    FROM public.cad_templates t
   WHERE t.is_system
     AND t.pack_key = p_pack_key
     AND t.stage = p_stage
   LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cad_resolve_template(uuid, uuid, text, public.cad_stage) TO authenticated;

-- 5. Helper: resolve todos os stages de um pack (usa a RPC acima como fonte única)
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
    'followup_5','followup_6','followup_7'
  ]::public.cad_stage[];
  _s public.cad_stage;
BEGIN
  FOREACH _s IN ARRAY _stages LOOP
    RETURN QUERY
    WITH r AS (
      SELECT * FROM public.cad_resolve_template(p_organization_id, p_owner_id, p_pack_key, _s)
    ),
    ov AS (
      SELECT id
        FROM public.cad_templates
       WHERE organization_id = p_organization_id
         AND owner_id = p_owner_id
         AND pack_key = p_pack_key
         AND stage = _s
       LIMIT 1
    )
    SELECT _s, r.titulo, r.corpo, r.source, ov.id
      FROM r LEFT JOIN ov ON true;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cad_list_resolved_templates(uuid, uuid, text) TO authenticated;