import { createFileRoute } from "@tanstack/react-router";
import { BriefingsDashboard } from "@/components/BriefingsDashboard";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";

export const Route = createFileRoute("/briefings")({
  head: () => ({ meta: [{ title: "Briefings Comerciais — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
      <BriefingsDashboard tipo="briefing_comercial" />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});
