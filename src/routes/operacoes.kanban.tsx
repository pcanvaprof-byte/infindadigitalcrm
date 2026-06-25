import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { EntregasKanban } from "@/modules/operacoes/components/EntregasKanban";
import { listClientes, listEntregas } from "@/modules/operacoes/api";

export const Route = createFileRoute("/operacoes/kanban")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Kanban — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Kanban de entregas">
        <KanbanPage />
      </AppShell>
    </RequireAuth>
  ),
});

function KanbanPage() {
  const entregasQ = useQuery({ queryKey: ["op-entregas"], queryFn: listEntregas });
  const clientesQ = useQuery({ queryKey: ["op-clientes"], queryFn: listClientes });

  return (
    <OperacoesLayout description="Organize criativos, relatórios, otimizações e reuniões por status. Arraste cards entre colunas para atualizar.">
      <EntregasKanban entregas={entregasQ.data ?? []} clientes={clientesQ.data ?? []} />
    </OperacoesLayout>
  );
}