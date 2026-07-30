-- ============================================================================
-- Perfis de novos usuários
-- 1) Cadastro público deixa de entrar na organização INFINDA.
--    Cada novo usuário ganha o próprio workspace (owner) + trial de 30 dias.
-- 2) Convites/provisionamento continuam funcionando via metadata invite_org_id.
-- 3) Usuários demo (is_demo) são ignorados: o fluxo demo cria a própria org.
-- 4) business_profiles passa a ser individual por usuário (user_id).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Novo gatilho de provisionamento de perfil
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_default_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta       jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_invite_org uuid;
  v_invite_rol text;
  v_org        uuid;
  v_label      text;
BEGIN
  -- Fluxo demo cuida da própria organização.
  IF COALESCE((v_meta->>'is_demo')::boolean, false) THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_invite_org := NULLIF(v_meta->>'invite_org_id', '')::uuid;
  EXCEPTION WHEN others THEN
    v_invite_org := NULL;
  END;

  IF v_invite_org IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_invite_org) THEN
    -- Usuário convidado por um admin: entra na organização indicada.
    v_invite_rol := COALESCE(NULLIF(v_meta->>'invite_role', ''), 'member');
    IF v_invite_rol NOT IN ('owner', 'admin', 'member') THEN
      v_invite_rol := 'member';
    END IF;

    INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (v_invite_org, NEW.id, v_invite_rol)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_active_org(user_id, organization_id)
    VALUES (NEW.id, v_invite_org)
    ON CONFLICT (user_id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    RETURN NEW;
  END IF;

  -- Cadastro público: workspace próprio, nunca a organização de produção.
  v_label := COALESCE(
    NULLIF(v_meta->>'full_name', ''),
    split_part(COALESCE(NEW.email, 'usuario'), '@', 1)
  );

  INSERT INTO public.organizations(name, slug, created_by)
  VALUES (
    left(v_label, 40) || ' workspace',
    'ws-' || substr(replace(NEW.id::text, '-', ''), 1, 12),
    NEW.id
  )
  RETURNING id INTO v_org;

  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (v_org, NEW.id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_active_org(user_id, organization_id)
  VALUES (NEW.id, v_org)
  ON CONFLICT (user_id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

  -- Trial de 30 dias para o cadastro público.
  INSERT INTO public.user_access(user_id, organization_id, status, access_type, expires_at, must_change_password)
  VALUES (NEW.id, v_org, 'active', 'trial', now() + interval '30 days', false)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_access_events(user_id, organization_id, event, meta)
  VALUES (NEW.id, v_org, 'ACCESS_CREATED', jsonb_build_object('source', 'signup', 'trialDays', 30));

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Nunca bloquear a criação do usuário por falha de provisionamento.
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_default_org ON auth.users;
CREATE TRIGGER on_auth_user_created_default_org
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_default_org();

-- ---------------------------------------------------------------------------
-- 2) business_profiles individual por usuário
-- ---------------------------------------------------------------------------
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Migra os perfis existentes para quem os criou.
UPDATE public.business_profiles
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;

DELETE FROM public.business_profiles WHERE user_id IS NULL;

ALTER TABLE public.business_profiles
  ALTER COLUMN user_id SET NOT NULL;

DROP INDEX IF EXISTS business_profiles_org_id_key;
ALTER TABLE public.business_profiles
  DROP CONSTRAINT IF EXISTS business_profiles_org_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS business_profiles_org_user_uidx
  ON public.business_profiles(org_id, user_id);

-- RLS: cada usuário enxerga e edita apenas o próprio perfil, na org ativa.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'business_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.business_profiles', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_profiles_select ON public.business_profiles
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY business_profiles_insert ON public.business_profiles
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY business_profiles_update ON public.business_profiles
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY business_profiles_delete ON public.business_profiles
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;

COMMIT;