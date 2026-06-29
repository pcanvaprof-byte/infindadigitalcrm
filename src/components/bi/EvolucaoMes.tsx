import { Card, CardContent } from "@/components/ui/card";
import { Activity, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import type { ResolvedPeriod } from "@/lib/bi/period";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  meta: number;
  realizado: number;
  period?: ResolvedPeriod;
}

export function EvolucaoMes({ meta, realizado, period }: Props) {
  const now = new Date();
  // Define janela de avaliação a partir do filtro global; default = mês corrente.
  const from = period?.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const to = period?.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const totalDias = Math.max(
    1,
    Math.round((+new Date(to.getFullYear(), to.getMonth(), to.getDate()) -
      +new Date(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000) + 1,
  );
  const decorridos = Math.max(
    1,
    Math.min(
      totalDias,
      Math.round((+new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
        +new Date(from.getFullYear(), from.getMonth(), from.getDate())) /
        86_400_000) + 1,
    ),
  );
  const restantes = Math.max(1, totalDias - decorridos);
  const idealAcum = Math.round((meta * decorridos) / totalDias);
  const diff = realizado - idealAcum;
  const diffPct = idealAcum > 0 ? Math.round((diff / idealAcum) * 100) : 0;
  const ritmoNecessario = Math.max(0, Math.ceil((meta - realizado) / restantes));

  let status: { label: string; tone: string; icon: typeof Activity };
  if (diffPct >= 0) status = { label: "No ritmo", tone: "text-emerald-400", icon: TrendingUp };
  else if (diffPct >= -15) status = { label: "Atenção", tone: "text-amber-400", icon: AlertTriangle };
  else status = { label: "Crítico", tone: "text-rose-400", icon: TrendingDown };
  const StatusIcon = status.icon;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> Evolução — {period?.label ?? "Este mês"}
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${status.tone}`}>
            <StatusIcon className="h-4 w-4" />
            {status.label}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Cell label={`Dia ${decorridos}/${totalDias}`} value={fmtBRL(realizado)} hint="Realizado" />
          <Cell label="Ideal acumulado" value={fmtBRL(idealAcum)} hint={`${Math.round((decorridos / totalDias) * 100)}% do período`} />
          <Cell
            label="Diferença"
            value={`${diff >= 0 ? "+" : ""}${fmtBRL(diff)}`}
            hint={`${diffPct >= 0 ? "+" : ""}${diffPct}% vs ideal`}
            tone={diff >= 0 ? "text-emerald-400" : "text-rose-400"}
          />
          <Cell
            label="Ritmo necessário"
            value={fmtBRL(ritmoNecessario)}
            hint={`por dia · ${restantes} dia(s) restante(s)`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}