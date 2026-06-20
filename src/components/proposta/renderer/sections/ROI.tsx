import { TrendingUp } from "lucide-react";
import { brl, type VMROI } from "@/lib/proposta/viewModel";

interface Props {
  roi: VMROI;
}

export function ROISection({ roi }: Props) {
  const hasNumbers =
    roi.economiaEstimada !== null || roi.faturamentoAdicional !== null || roi.paybackMeses !== null;

  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">04 · Projeção</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">Retorno esperado</h2>
      </div>

      {hasNumbers && (
        <div className="grid gap-4 md:grid-cols-3">
          {roi.economiaEstimada !== null && (
            <StatCard label="Economia estimada" value={brl(roi.economiaEstimada)} sub="/ ano" />
          )}
          {roi.faturamentoAdicional !== null && (
            <StatCard label="Faturamento adicional" value={brl(roi.faturamentoAdicional)} sub="/ ano" highlight />
          )}
          {roi.paybackMeses !== null && (
            <StatCard label="Payback estimado" value={`${roi.paybackMeses}`} sub={roi.paybackMeses === 1 ? "mês" : "meses"} />
          )}
        </div>
      )}

      {roi.premissas.length > 0 && (
        <div className="rounded-2xl bg-card/50 ring-1 ring-border p-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Premissas</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {roi.premissas.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 ring-1 ring-primary/40 p-6 shadow-lg shadow-primary/10"
          : "rounded-2xl bg-card ring-1 ring-border p-6"
      }
    >
      <div className="flex items-center gap-2 text-primary-glow">
        <TrendingUp className="size-5" />
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl md:text-4xl font-bold tracking-tight">{value}</span>
        <span className="text-sm text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}