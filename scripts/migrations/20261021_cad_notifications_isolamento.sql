-- ============================================================================
-- Fecha o vazamento restante da cadência: cad_notifications.
--
-- Auditoria (30/07/2026) mostrou um member (Juliana) enxergando notificações
-- de leads de outro usuário, mesmo com _can_see_cad_lead() retornando false.
-- Causa: existe(m) policy(ies) PERMISSIVE extra(s) em cad_notifications com
-- escopo apenas organizacional, que fazem OR com a policy correta.
--
-- Correção: remove TODAS as policies da tabela, recria as corretas e adiciona
-- uma policy RESTRICTIVE (AND com qualquer outra) para blindar o futuro.
-- ============================================================================

BEGIN;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'cad_notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.cad_notifications', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.cad_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY cad_notif_select ON public.cad_notifications
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

CREATE POLICY cad_notif_write ON public.cad_notifications
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

-- Blindagem: qualquer policy permissiva futura ainda precisará passar por aqui.
CREATE POLICY cad_notif_owner_restrictive ON public.cad_notifications
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public._can_see_cad_lead(lead_id)
  );

NOTIFY pgrst, 'reload schema';

COMMIT;