import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getClient } from "@/modules/lifecycle/api";
import { RelacionamentoView } from "@/modules/operacoes/views/RelacionamentoView";

export const Route = createFileRoute("/operacoes/clientes/$id/relacionamento")({
  ssr: false,
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });
  const opClientId = q.data?.source_ref ?? undefined;
  if (!q.data) return null;
  if (!opClientId) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Este cliente ainda não está vinculado ao cadastro operacional.
      </Card>
    );
  }
  return <RelacionamentoView clientId={opClientId} />;
}