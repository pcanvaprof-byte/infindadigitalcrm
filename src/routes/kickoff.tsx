import { createFileRoute } from "@tanstack/react-router";
import { BriefingsDashboard } from "@/components/BriefingsDashboard";
import { RequireAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/kickoff")({
  head: () => ({ meta: [{ title: "Kickoff de Produção — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <BriefingsDashboard tipo="kickoff_producao" />
    </RequireAuth>
  ),
});
