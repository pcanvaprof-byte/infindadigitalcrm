-- =========================================================
-- 1) CAD_MESSAGES: reverter para privacidade por usuário
-- =========================================================
DROP POLICY IF EXISTS cad_messages_select_org ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_select_own ON public.cad_messages;
DROP POLICY IF EXISTS cad_messages_select ON public.cad_messages;

CREATE POLICY cad_messages_select_own ON public.cad_messages
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND (
      public._is_org_admin()
      OR author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.cad_leads l
        WHERE l.id = cad_messages.lead_id
          AND l.owner_id = auth.uid()
      )
    )
  );

-- =========================================================
-- 2) BUSINESS_PROFILES: perfil privado por usuário
-- =========================================================

-- Adiciona coluna user_id (nullable temporariamente para permitir backfill)
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill: usa created_by (ou updated_by) para linhas existentes
UPDATE public.business_profiles
   SET user_id = COALESCE(created_by, updated_by)
 WHERE user_id IS NULL;

-- Remove linhas órfãs (sem created_by nem updated_by — não deveria haver, mas por segurança)
DELETE FROM public.business_profiles WHERE user_id IS NULL;

-- Torna NOT NULL
ALTER TABLE public.business_profiles
  ALTER COLUMN user_id SET NOT NULL;

-- Troca unicidade: antes era só por org_id; agora é por (org_id, user_id)
ALTER TABLE public.business_profiles
  DROP CONSTRAINT IF EXISTS business_profiles_org_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS business_profiles_org_user_uq
  ON public.business_profiles(org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_business_profiles_user
  ON public.business_profiles(user_id);

-- Reescreve políticas: privado por usuário dentro da org
DROP POLICY IF EXISTS bp_select_org ON public.business_profiles;
DROP POLICY IF EXISTS bp_insert_org ON public.business_profiles;
DROP POLICY IF EXISTS bp_update_org ON public.business_profiles;
DROP POLICY IF EXISTS bp_delete_org ON public.business_profiles;
DROP POLICY IF EXISTS bp_select_own ON public.business_profiles;
DROP POLICY IF EXISTS bp_insert_own ON public.business_profiles;
DROP POLICY IF EXISTS bp_update_own ON public.business_profiles;
DROP POLICY IF EXISTS bp_delete_own ON public.business_profiles;

CREATE POLICY bp_select_own ON public.business_profiles
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY bp_insert_own ON public.business_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY bp_update_own ON public.business_profiles
  FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY bp_delete_own ON public.business_profiles
  FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND user_id = auth.uid()
  );