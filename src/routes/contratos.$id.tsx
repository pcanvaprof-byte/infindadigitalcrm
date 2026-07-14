import { createFileRoute, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";
import { ContractWizard } from "@/components/contratos/ContractWizard";

export const Route = createFileRoute("/contratos/$id")({
  head: () => ({ meta: [{ title: "Formalização Contratual — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
      <ContratoEditorPage />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});

function ContratoEditorPage() {
  const { id } = useParams({ from: "/contratos/$id" });
  return (
    <AppShell
      title="Formalização Contratual"
      subtitle="Onboarding contratual — Wizard guiado · INFINDA"
    >
      <ContractWizard contratoId={id} />
    </AppShell>
  );
}