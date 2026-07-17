import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAccessStatus } from "@/lib/access/access.functions";
import { useAuth } from "@/lib/auth-context";

export type AccessStatus = {
  status: "active" | "expired" | "suspended";
  access_type: "trial" | "paid" | "internal" | null;
  plan_name: string | null;
  expires_at: string | null;
  days_remaining: number | null;
  must_change_password: boolean;
  is_privileged: boolean;
};

export function useAccessStatus() {
  const { user, isReady } = useAuth();
  const fetchStatus = useServerFn(getAccessStatus);
  return useQuery<AccessStatus>({
    queryKey: ["access-status", user?.id ?? null],
    enabled: isReady && !!user?.id,
    queryFn: () => fetchStatus() as Promise<AccessStatus>,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}