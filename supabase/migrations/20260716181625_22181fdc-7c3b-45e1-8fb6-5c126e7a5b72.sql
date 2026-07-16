
-- Reforço de RLS: dados privados do usuário (touchpoints, cadência, follow-ups)
-- só podem ser lidos/alterados pelo próprio dono, mesmo via API direta.
-- Estratégia: adicionar policies RESTRICTIVE de owner (aplicadas em conjunção
-- com todas as demais), fechar WITH CHECK em UPDATEs, e revogar acesso ao role
-- anon nessas tabelas privadas.

------------------------------------------------------------------
-- 1) user_lead_state  (estado privado por usuário: status, cadência, follow-up)
------------------------------------------------------------------
REVOKE ALL ON public.user_lead_state FROM anon;

-- Impede que um UPDATE mova a linha para outro user_id / outra org
DROP POLICY IF EXISTS uls_own_update ON public.user_lead_state;
CREATE POLICY uls_own_update ON public.user_lead_state
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND organization_id = current_org_id());

-- Restrictive: mesmo que outra policy permissiva seja adicionada por engano,
-- qualquer operação exige user_id = auth.uid().
DROP POLICY IF EXISTS uls_owner_only_restrictive ON public.user_lead_state;
CREATE POLICY uls_owner_only_restrictive ON public.user_lead_state
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

------------------------------------------------------------------
-- 2) prospect_touchpoints  (acionamentos/cadência gravados pelo usuário)
------------------------------------------------------------------
REVOKE ALL ON public.prospect_touchpoints FROM anon;

-- Fecha UPDATE para não permitir trocar o user_id da linha
DROP POLICY IF EXISTS "touchpoints owner update" ON public.prospect_touchpoints;
CREATE POLICY "touchpoints owner update" ON public.prospect_touchpoints
  FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS touchpoints_owner_only_restrictive ON public.prospect_touchpoints;
CREATE POLICY touchpoints_owner_only_restrictive ON public.prospect_touchpoints
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

------------------------------------------------------------------
-- 3) prospect_interactions  (histórico privado de interações)
------------------------------------------------------------------
REVOKE ALL ON public.prospect_interactions FROM anon;

DROP POLICY IF EXISTS interactions_owner_only_restrictive ON public.prospect_interactions;
CREATE POLICY interactions_owner_only_restrictive ON public.prospect_interactions
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
