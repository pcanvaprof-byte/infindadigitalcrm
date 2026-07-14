import { createFileRoute } from "@tanstack/react-router";
import { BriefingsDashboard } from "@/components/BriefingsDashboard";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";

export const Route = createFileRoute("/kickoff")({
  head: () => ({ meta: [{ title: "Kickoff de Produção — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
      <BriefingsDashboard tipo="kickoff_producao" />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});
