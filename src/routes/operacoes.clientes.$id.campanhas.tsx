import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getClient } from "@/modules/lifecycle/api";
import { CampanhasView } from "@/modules/operacoes/views/CampanhasView";

export const Route = createFileRoute("/operacoes/clientes/$id/campanhas")({
  ssr: false,
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });
  const opClientId = q.data?.source_ref ?? undefined;
  if (!q.data) return null;
  if (q.data.operations_locked) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm font-semibold">🔒 Operações bloqueadas</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Avance o estágio para <b>ATIVO</b> para liberar campanhas.
        </p>
      </Card>
    );
  }
  if (!opClientId) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Este cliente ainda não está vinculado ao cadastro operacional.
      </Card>
    );
  }
  return <CampanhasView clientId={opClientId} />;
}