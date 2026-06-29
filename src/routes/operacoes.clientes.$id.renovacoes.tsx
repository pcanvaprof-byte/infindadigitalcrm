import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getClient } from "@/modules/lifecycle/api";
import { RenovacoesView } from "@/modules/operacoes/views/RenovacoesView";

export const Route = createFileRoute("/operacoes/clientes/$id/renovacoes")({
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
  return <RenovacoesView clientId={opClientId} />;
}