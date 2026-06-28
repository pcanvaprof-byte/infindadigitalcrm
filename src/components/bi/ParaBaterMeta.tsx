import { Card, CardContent } from "@/components/ui/card";
import { Target, Users, CalendarClock, FileText, TrendingUp } from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  meta: number;
  realizado: number;
  ticket: number;
  /** Taxa de conversão lead→contrato (0–100) */
  taxaConversao?: number | null;
  /** Taxa de conversão reunião→contrato (0–100). Default: 30% */
  taxaReuniao?: number | null;
}

export function ParaBaterMeta({ meta, realizado, ticket, taxaConversao, taxaReuniao }: Props) {
  const gap = Math.max(0, meta - realizado);
  const contratos = ticket > 0 ? Math.ceil(gap / ticket) : 0;
  const convPct = taxaConversao && taxaConversao > 0 ? taxaConversao : 5; // fallback prudente
  const reuPct = taxaReuniao && taxaReuniao > 0 ? taxaReuniao : 30;
  const leads = contratos > 0 && convPct > 0 ? Math.ceil((contratos * 100) / convPct) : 0;
  const reunioes = contratos > 0 && reuPct > 0 ? Math.ceil((contratos * 100) / reuPct) : 0;

  const items = [
    { icon: TrendingUp, label: "Em receita", value: fmtBRL(gap), tone: "text-rose-400" },
    { icon: FileText, label: "Contratos", value: `${contratos}`, tone: "text-amber-400" },
    { icon: Users, label: "Leads qualificados", value: `${leads}`, tone: "text-sky-400" },
    { icon: CalendarClock, label: "Reuniões", value: `${reunioes}`, tone: "text-violet-400" },
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
          <Target className="h-3.5 w-3.5" /> Para bater a meta
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimado a partir do ticket médio e taxas de conversão históricas
        </p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.label} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] uppercase tracking-wider">{it.label}</span>
                </div>
                <p className={`mt-2 text-2xl font-semibold tabular-nums ${it.tone}`}>{it.value}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}