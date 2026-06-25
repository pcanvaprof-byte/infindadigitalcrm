import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getClient } from "@/modules/lifecycle/api";

export const Route = createFileRoute("/clients/$id/operacoes")({
  ssr: false,
  component: OperacoesPage,
});

function OperacoesPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });
  const c = q.data;
  if (!c) return null;

  if (c.operations_locked) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-semibold">🔒 Operações bloqueadas</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Avance o estágio para <b>ATIVO</b> para liberar campanhas, entregas e reuniões.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-2 p-4">
      <p className="text-sm font-semibold">Operações</p>
      <p className="text-xs text-muted-foreground">
        Cliente ativo. Acesse o módulo{" "}
        <a className="underline" href="/operacoes/campanhas">/operacoes</a> para gerenciar
        campanhas, entregas e reuniões.
      </p>
    </Card>
  );
}