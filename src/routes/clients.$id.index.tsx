import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { getClient } from "@/modules/lifecycle/api";
import { STAGE_LABEL } from "@/modules/lifecycle/types";

export const Route = createFileRoute("/clients/$id/")({
  ssr: false,
  component: ResumoPage,
});

function ResumoPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });
  const c = q.data;
  if (!c) return null;

  const days =
    c.activated_at != null
      ? Math.floor((Date.now() - new Date(c.activated_at).getTime()) / 86400000)
      : null;

  const items = [
    { label: "Plano", value: c.plano_code ?? "—" },
    {
      label: "Mensalidade",
      value: c.mensalidade != null ? `R$ ${Number(c.mensalidade).toFixed(2)}` : "—",
    },
    { label: "Estágio", value: STAGE_LABEL[c.pipeline_stage] },
    { label: "Status financeiro", value: c.financial_status },
    { label: "Status contrato", value: c.lc_contract_status },
    { label: "Onboarding", value: c.onboarding_status },
    { label: "Cliente há", value: days != null ? `${days} dias` : "—" },
    { label: "Próxima ação", value: c.next_action_date ?? c.current_step ?? "—" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{it.label}</p>
          <p className="mt-1 truncate text-sm font-medium">{String(it.value)}</p>
        </Card>
      ))}
    </div>
  );
}