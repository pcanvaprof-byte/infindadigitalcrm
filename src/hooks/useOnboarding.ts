import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getOnboardingState,
  markOnboardingSeen,
  resetOnboardingSeen,
  type OnboardingState,
} from "@/lib/access/onboarding.functions";
import { useAuth } from "@/lib/auth-context";

export const ONBOARDING_QK = ["onboarding-state"] as const;

/** Evento global para reabrir o tour de qualquer tela. */
export const OPEN_TOUR_EVENT = "infinda:open-tour";

export function openWelcomeTour() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_TOUR_EVENT));
  }
}

/** Fallback local enquanto a migração `onboarded_at` não estiver aplicada. */
export function localSeenKey(userId: string | null | undefined) {
  return `infinda:onboarding-seen:${userId ?? "anon"}`;
}

export function useOnboardingState() {
  const { user, isReady } = useAuth();
  const fetchFn = useServerFn(getOnboardingState);
  return useQuery<OnboardingState>({
    queryKey: [...ONBOARDING_QK, user?.id ?? null],
    enabled: isReady && !!user?.id,
    queryFn: () => fetchFn() as Promise<OnboardingState>,
    staleTime: 30_000,
  });
}

export function useMarkOnboardingSeen() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fn = useServerFn(markOnboardingSeen);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(localSeenKey(user?.id), "1");
      }
      qc.invalidateQueries({ queryKey: ONBOARDING_QK });
    },
  });
}

export function useResetOnboarding() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fn = useServerFn(resetOnboardingSeen);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(localSeenKey(user?.id));
      }
      qc.invalidateQueries({ queryKey: ONBOARDING_QK });
    },
  });
}
