import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getClient } from "@/modules/lifecycle/api";

export const Route = createFileRoute("/operacoes/clientes/$id/documentos")({
  ssr: false,
  component: DocumentosPage,
});

function DocumentosPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });
  const c = q.data;
  if (!c) return null;
  return (
    <Card className="space-y-2 p-4">
      <p className="text-sm font-semibold">Documentos</p>
      <p className="text-xs text-muted-foreground">
        Status do contrato: <b>{c.lc_contract_status}</b>
      </p>
      <p className="text-xs text-muted-foreground">
        Use o módulo <a className="underline" href="/contratos">/contratos</a> para gerar/enviar o
        contrato. Ao marcar como assinado, avance o estágio para <b>PAGAMENTO_CONFIRMADO</b>.
      </p>
    </Card>
  );
}