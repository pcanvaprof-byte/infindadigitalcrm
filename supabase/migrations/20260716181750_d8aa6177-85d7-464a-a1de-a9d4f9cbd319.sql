
-- 1) Rastreabilidade no lead: qual importação o originou, quem importou e quando.
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS import_id   uuid REFERENCES public.prospect_imports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS imported_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS imported_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_prospects_import_id ON public.prospects(import_id);
CREATE INDEX IF NOT EXISTS idx_prospects_imported_by ON public.prospects(imported_by);

-- 2) prospect_imports precisa carregar a organização para a policy de admin.
ALTER TABLE public.prospect_imports
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- Backfill: usa a org ativa do usuário; se não houver, cai para org do usuário
-- via organization_members (primeiro vínculo).
UPDATE public.prospect_imports pi
   SET organization_id = COALESCE(
     (SELECT uao.organization_id FROM public.user_active_org uao WHERE uao.user_id = pi.user_id),
     (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = pi.user_id LIMIT 1)
   )
 WHERE organization_id IS NULL;

ALTER TABLE public.prospect_imports
  ALTER COLUMN organization_id SET DEFAULT public.current_org_id();

CREATE INDEX IF NOT EXISTS idx_prospect_imports_org ON public.prospect_imports(organization_id);

-- 3) Policies: além do dono, admins/owners da mesma org podem LER o histórico
--    de importações (auditoria). Escrita continua restrita ao próprio importador.
DROP POLICY IF EXISTS "prospect_imports admin org read" ON public.prospect_imports;
CREATE POLICY "prospect_imports admin org read" ON public.prospect_imports
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.current_org_role() IN ('owner','admin')
  );

-- 4) View de auditoria por lead: só campos cadastrais + rastreio da importação.
--    NÃO expõe status/cadência/follow-up/last_contact_at (dados privados por vendedor
--    vivem em user_lead_state e continuam protegidos pelas policies dessa tabela).
CREATE OR REPLACE VIEW public.v_prospect_import_audit
WITH (security_invoker = on) AS
SELECT
  p.id            AS prospect_id,
  p.organization_id,
  p.import_id,
  p.imported_by,
  p.imported_at,
  p.created_at,
  p.company,
  p.cnpj,
  p.segment,
  p.city,
  p.state,
  p.source,
  i.file_name     AS import_file_name,
  i.performed_by  AS import_performed_by,
  i.total_rows    AS import_total_rows,
  i.inserted_count AS import_inserted_count
FROM public.prospects p
LEFT JOIN public.prospect_imports i ON i.id = p.import_id;

GRANT SELECT ON public.v_prospect_import_audit TO authenticated;

-- 5) Trigger: quando um lead é inserido com import_id, preencher imported_by/at
--    automaticamente (caso o app não envie).
CREATE OR REPLACE FUNCTION public.prospects_stamp_import()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.import_id IS NOT NULL THEN
    IF NEW.imported_by IS NULL THEN NEW.imported_by := auth.uid(); END IF;
    IF NEW.imported_at IS NULL THEN NEW.imported_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prospects_stamp_import ON public.prospects;
CREATE TRIGGER trg_prospects_stamp_import
  BEFORE INSERT ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.prospects_stamp_import();
