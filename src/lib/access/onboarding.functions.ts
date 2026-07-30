import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/lib/app-auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type OnboardingSteps = {
  password: boolean;
  business: boolean;
  dispatch: boolean;
};

export type OnboardingState = {
  /** Já viu (ou fechou) o tour de boas-vindas alguma vez. */
  seen: boolean;
  steps: OnboardingSteps;
  /** Quantos passos concluídos de 3. */
  done: number;
  total: number;
  completed: boolean;
};

const EMPTY_STEPS: OnboardingSteps = { password: true, business: false, dispatch: false };

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingState> => {
    const supabase = (context as unknown as { supabase: AnyClient }).supabase;
    const userId = (context as unknown as { userId: string }).userId;

    let seen = false;
    let password = true;

    // 1) user_access: onboarded_at + troca de senha pendente.
    // Fail-open: se a coluna/migração ainda não existir, tratamos como "nunca viu".
    try {
      const { data, error } = await supabase
        .from("user_access")
        .select("onboarded_at, must_change_password")
        .eq("user_id", userId)
        .maybeSingle();
      if (!error && data) {
        seen = !!(data as { onboarded_at?: string | null }).onboarded_at;
        password = !(data as { must_change_password?: boolean }).must_change_password;
      }
    } catch {
      /* migração pendente — segue com defaults */
    }

    // 2) Perfil do negócio configurado.
    let business = false;
    try {
      const { data: orgId } = await supabase.rpc("current_org_id");
      if (orgId) {
        const { data } = await supabase
          .from("business_profiles")
          .select("onboarding_status, initial_message")
          .eq("org_id", orgId)
          .eq("user_id", userId)
          .maybeSingle();
        const p = data as { onboarding_status?: string; initial_message?: string | null } | null;
        business = !!p && p.onboarding_status === "completed" && !!p.initial_message?.trim();
      }
    } catch {
      /* ignore */
    }

    // 3) Pelo menos um disparo registrado.
    let dispatch = false;
    try {
      const { count } = await supabase
        .from("prospect_touchpoints")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      dispatch = (count ?? 0) > 0;
    } catch {
      /* ignore */
    }

    const steps: OnboardingSteps = { ...EMPTY_STEPS, password, business, dispatch };
    const done = Object.values(steps).filter(Boolean).length;
    return { seen, steps, done, total: 3, completed: done === 3 };
  });

export const markOnboardingSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as unknown as { supabase: AnyClient }).supabase;
    try {
      await supabase.rpc("mark_onboarding_seen");
    } catch {
      /* migração pendente — a UI ainda suprime via localStorage */
    }
    return { ok: true };
  });

export const resetOnboardingSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as unknown as { supabase: AnyClient }).supabase;
    try {
      await supabase.rpc("reset_onboarding_seen");
    } catch {
      /* ignore */
    }
    return { ok: true };
  });
