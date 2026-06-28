import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, MessageSquare, Send } from "lucide-react";
import { fetchTodayMetrics, type TodayMetrics } from "@/lib/bi/today";

type Props = {
  visitsGoal: number;
  contactsGoal: number;
  dispatchesGoal: number;
};

function tone(pct: number): { dot: string; text: string; label: string } {
  if (pct >= 100) return { dot: "bg-emerald-500", text: "text-emerald-400", label: "no ritmo" };
  if (pct >= 60)  return { dot: "bg-amber-500",   text: "text-amber-400",   label: "atenção" };
  return            { dot: "bg-rose-500",    text: "text-rose-400",    label: "crítico" };
}

function Row({
  icon: Icon, label, done, goal,
}: {
  icon: typeof Calendar; label: string; done: number; goal: number;
}) {
  const pct = goal > 0 ? Math.round((done / goal) * 100) : 0;
  const faltam = Math.max(0, goal - done);
  const t = tone(pct);
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {label}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] ${t.text}`}>
          <span className={`h-2 w-2 rounded-full ${t.dot}`} /> {t.label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{done}</span>
        <span className="text-xs text-muted-foreground">/ {goal}</span>
        <Badge variant="secondary" className={t.text}>{pct}%</Badge>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div className={`h-full ${t.dot}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {faltam > 0 ? <>Faltam <strong className="text-foreground">{faltam}</strong> p/ bater hoje</> : "Meta diária atingida"}
      </p>
    </div>
  );
}

export function HojePanel({ visitsGoal, contactsGoal, dispatchesGoal }: Props) {
  const q = useQuery<TodayMetrics>({
    queryKey: ["bi", "today"],
    queryFn: fetchTodayMetrics,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const d = q.data ?? { visitas: 0, contatos: 0, disparos: 0 };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" /> Hoje
          <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
            {q.isFetching ? "atualizando…" : "tempo real"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Row icon={MapPin}          label="Visitas"  done={d.visitas}  goal={visitsGoal} />
        <Row icon={MessageSquare}   label="Contatos" done={d.contatos} goal={contactsGoal} />
        <Row icon={Send}            label="Disparos" done={d.disparos} goal={dispatchesGoal} />
      </CardContent>
    </Card>
  );
}