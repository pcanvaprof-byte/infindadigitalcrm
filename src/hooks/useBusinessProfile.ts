import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBusinessProfile,
  saveBusinessInputs,
  analyzeBusinessWithAI,
  regenerateInitialMessage,
  confirmBusinessProfile,
  regenerateOrgCadTemplates,
} from "@/lib/business/business.functions";

export const BUSINESS_QK = ["business_profile"] as const;

export function useBusinessProfile() {
  const fetchFn = useServerFn(getBusinessProfile);
  return useQuery({
    queryKey: BUSINESS_QK,
    queryFn: () => fetchFn(),
    staleTime: 30_000,
  });
}

export function useSaveBusinessInputs() {
  const qc = useQueryClient();
  const fn = useServerFn(saveBusinessInputs);
  return useMutation({
    mutationFn: (data: Parameters<typeof saveBusinessInputs>[0] extends { data: infer D } ? D : Record<string, string>) =>
      fn({ data } as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: BUSINESS_QK }),
  });
}

export function useAnalyzeBusiness() {
  const qc = useQueryClient();
  const fn = useServerFn(analyzeBusinessWithAI);
  return useMutation({
    mutationFn: (data: Record<string, string>) => fn({ data } as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: BUSINESS_QK }),
  });
}

export function useRegenerateMessage() {
  const qc = useQueryClient();
  const fn = useServerFn(regenerateInitialMessage);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: BUSINESS_QK }),
  });
}

export function useConfirmBusiness() {
  const qc = useQueryClient();
  const fn = useServerFn(confirmBusinessProfile);
  return useMutation({
    mutationFn: (initial_message: string) => fn({ data: { initial_message } } as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: BUSINESS_QK }),
  });
}

export function useRegenerateOrgCadTemplates() {
  const fn = useServerFn(regenerateOrgCadTemplates);
  return useMutation({
    mutationFn: () => fn(),
  });
}