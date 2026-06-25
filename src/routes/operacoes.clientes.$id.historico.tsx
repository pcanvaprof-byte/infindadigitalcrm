import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getTimeline } from "@/modules/lifecycle/api";

export const Route = createFileRoute("/operacoes/clientes/$id/historico")({
  ssr: false,
  component: HistoricoPage,
});

function HistoricoPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-timeline", id], queryFn: () => getTimeline(id) });
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const items = q.data ?? [];
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">Sem eventos ainda.</p>;

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <Card key={i} className="p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium capitalize">{it.kind}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(it.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
          <pre className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
            {JSON.stringify(it.data, null, 2)}
          </pre>
        </Card>
      ))}
    </div>
  );
}