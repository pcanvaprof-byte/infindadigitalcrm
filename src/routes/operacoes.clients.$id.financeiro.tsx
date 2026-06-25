import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getClient } from "@/modules/lifecycle/api";

export const Route = createFileRoute("/operacoes/clients/$id/financeiro")({
  ssr: false,
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });
  const c = q.data;
  if (!c) return null;
  return (
    <Card className="space-y-2 p-4">
      <p className="text-sm font-semibold">Financeiro</p>
      <p className="text-xs text-muted-foreground">
        Status: <b>{c.financial_status}</b>
      </p>
      <p className="text-xs text-muted-foreground">
        Mensalidade: <b>{c.mensalidade != null ? `R$ ${Number(c.mensalidade).toFixed(2)}` : "—"}</b>
      </p>
      <p className="text-xs text-muted-foreground">
        Cobrança recorrente e inadimplência entram na Onda 2.
      </p>
    </Card>
  );
}