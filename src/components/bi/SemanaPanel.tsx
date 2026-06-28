import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarRange } from "lucide-react";
import { fetchWeekMetrics, type WeekMetrics } from "@/lib/bi/today";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function diasUteisSemanaAteHoje(d = new Date()): number {
  const dow = d.getDay(); // 0=dom..6=sáb
  if (dow === 0) return 5; // domingo conta semana cheia
  if (dow === 6) return 5;
  return dow; // seg=1..sex=5
}

export function SemanaPanel({ metaSemanal }: { metaSemanal: number }) {
  const q = useQuery<WeekMetrics>({
    queryKey: ["bi", "week"],
    queryFn: fetchWeekMetrics,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const d = q.data ?? { receita: 0, disparos: 0, contatos: 0 };
  const dia = diasUteisSemanaAteHoje();
  const projetada = dia > 0 ? Math.round((d.receita / dia) * 5) : 0;
  const pct = metaSemanal > 0 ? Math.round((d.receita / metaSemanal) * 100) : 0;
  const prob = metaSemanal > 0 ? Math.round((projetada / metaSemanal) * 100) : 0;
  const tone = prob >= 100 ? "text-emerald-400" : prob >= 80 ? "text-amber-400" : "text-rose-400";
  const gap = Math.max(0, metaSemanal - d.receita);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" /> Cockpit Semanal
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
            dia útil {dia}/5
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-semibold">{fmtBRL(d.receita)}</span>
          <span className="text-sm text-muted-foreground">de {fmtBRL(metaSemanal)}</span>
          <Badge variant="secondary" className={tone}>{pct}% da meta</Badge>
        </div>
        <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border border-border/60 bg-card/40 p-2">
            <p className="text-muted-foreground">Projeção sex</p>
            <p className={`font-medium ${tone}`}>{fmtBRL(projetada)}</p>
          </div>
          <div className="rounded border border-border/60 bg-card/40 p-2">
            <p className="text-muted-foreground">Gap p/ meta</p>
            <p className="font-medium text-foreground">{fmtBRL(gap)}</p>
          </div>
          <div className="rounded border border-border/60 bg-card/40 p-2">
            <p className="text-muted-foreground">Disparos · contatos</p>
            <p className="font-medium text-foreground">{d.disparos} · {d.contatos}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}