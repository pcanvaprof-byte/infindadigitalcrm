-- 1) clients: owner OR org admin
DROP POLICY IF EXISTS "clients owner all" ON public.clients;

CREATE POLICY "clients_owner_or_admin"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) deal_stages: revoke any residual anon privileges (defense in depth)
REVOKE ALL ON public.deal_stages FROM anon;
