import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  dashboardV8Keys, listActiveAlerts, recomputeAlerts, resolveAlert,
  type DashboardAlert,
} from "@/lib/dashboard/api-v8";

const SEV_ICON: Record<DashboardAlert["severity"], React.ComponentType<{ className?: string }>> = {
  danger: AlertCircle,
  warn:   AlertTriangle,
  info:   Info,
};
const SEV_STYLE: Record<DashboardAlert["severity"], string> = {
  danger: "border-rose-500/30    bg-rose-500/5    text-rose-200",
  warn:   "border-amber-500/30   bg-amber-500/5   text-amber-200",
  info:   "border-sky-500/30     bg-sky-500/5     text-sky-200",
};

export function AlertsPanel() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: dashboardV8Keys.alerts,
    queryFn: listActiveAlerts,
    staleTime: 60_000,
  });
  const resolve = useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardV8Keys.alerts }),
  });
  const recompute = useMutation({
    mutationFn: recomputeAlerts,
    onSuccess: (n) => {
      toast.success(`Alertas atualizados (${n} verificações)`);
      qc.invalidateQueries({ queryKey: dashboardV8Keys.alerts });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const alerts = q.data ?? [];

  return (
    <section className="surface-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Alertas ({alerts.length})
        </h4>
        <Button variant="ghost" size="sm" className="h-7 text-xs"
          onClick={() => recompute.mutate()} disabled={recompute.isPending}>
          <RefreshCw className={`mr-1 h-3 w-3 ${recompute.isPending ? "animate-spin" : ""}`} />
          Recalcular
        </Button>
      </header>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4" /> Nenhum alerta ativo no momento.
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const Icon = SEV_ICON[a.severity];
            return (
              <li key={a.id} className={`flex items-start gap-3 rounded-md border p-3 text-xs ${SEV_STYLE[a.severity]}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.title}</p>
                  {a.detail && <p className="mt-0.5 text-muted-foreground">{a.detail}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {a.kind.replaceAll("_", " ")} · {a.scope}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                  onClick={() => resolve.mutate(a.id)} disabled={resolve.isPending}>
                  Resolver
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}