-- ============================================================
-- Onboarding de boas-vindas (pop-up + checklist de primeiros passos)
-- Rodar no SQL editor do Supabase do app. Idempotente.
-- ============================================================

-- 1) Marca de "já viu o tour" persistida por usuário -----------------------
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

COMMENT ON COLUMN public.user_access.onboarded_at IS
  'Quando o usuário concluiu/fechou o tour de boas-vindas. NULL = nunca viu.';

-- 2) RPC para o próprio usuário marcar o tour como visto -------------------
-- user_access não expõe UPDATE para authenticated (apenas SELECT),
-- por isso usamos SECURITY DEFINER restrito a auth.uid().
CREATE OR REPLACE FUNCTION public.mark_onboarding_seen()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ts  timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.user_access
     SET onboarded_at = COALESCE(onboarded_at, v_ts)
   WHERE user_id = v_uid
  RETURNING onboarded_at INTO v_ts;

  RETURN v_ts;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_onboarding_seen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_onboarding_seen() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_onboarding_seen() TO authenticated;

-- 3) RPC para reabrir o tour (botão "Ver tour novamente") ------------------
CREATE OR REPLACE FUNCTION public.reset_onboarding_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  UPDATE public.user_access SET onboarded_at = NULL WHERE user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_onboarding_seen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_onboarding_seen() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_onboarding_seen() TO authenticated;
