
-- Restringir SELECT em api_keys: apenas admins ou o criador da chave podem ler
DROP POLICY IF EXISTS "Members can view org api keys" ON public.api_keys;
CREATE POLICY "Admins or creator can view api keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (
    is_member_of_org(organization_id)
    AND (created_by = auth.uid() OR is_org_admin(organization_id))
  );

-- Exigir posse da proposta ao inserir notas
DROP POLICY IF EXISTS "proposal_notes insert same org" ON public.proposal_notes;
CREATE POLICY "proposal_notes insert owner of proposal"
  ON public.proposal_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = current_org_id()
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.proposals p
      WHERE p.id = proposal_notes.proposal_id
        AND (p.user_id = auth.uid() OR is_org_admin(current_org_id()))
    )
  );
