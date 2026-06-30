import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Zap, ExternalLink } from "lucide-react";
import { auditDispatches } from "@/lib/bi/dispatches.functions";

/**
 * Painel "Disparos hoje + 7d" — fonte canônica calculada no backend
 * (server function lendo cad_messages + prospect_touchpoints diretamente,
 * sem depender do estado do navegador).
 */
export function DispatchesPanel() {
  const audit = useServerFn(auditDispatches);
  const q = useQuery({
    queryKey: ["dashboard", "dispatches-panel"],
    queryFn: () => audit({ data: {} }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (q.isLoading) {
    return (
      <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 animate-pulse">
        <div className="h-4 w-40 bg-white/[0.06] rounded mb-3" />
        <div className="h-16 bg-white/[0.04] rounded" />
      </section>
    );
  }
  if (q.error || !q.data) return null;

  const d = q.data;
  const today = d.today;
  const yesterday = d.yesterday;
  const week = d.last7d;
  const maxDay = Math.max(...d.daily_series.map((s) => s.total), 1);
  const deltaPct = yesterday.total > 0
    ? Math.round(((today.total - yesterday.total) / yesterday.total) * 100)
    : null;

  return (
    <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-500/10 p-1.5">
            <Zap className="h-4 w-4 text-cyan-400" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            Disparos — Hoje e últimos 7 dias
          </h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            Backend
          </span>
        </div>
        <Link
          to="/bi/disparos"
          className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:underline"
        >
          Auditoria completa <ExternalLink className="h-3 w-3" />
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        {/* Coluna 1: Hoje */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hoje
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{today.total}</span>
            {deltaPct !== null && (
              <span className={`text-xs font-semibold ${deltaPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {deltaPct >= 0 ? "+" : ""}{deltaPct}% vs ontem
              </span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Mini label="Cadência" value={today.cadencia} />
            <Mini label="Prospecção" value={today.prospeccao} />
            <Mini label="WhatsApp" value={today.por_tipo.whatsapp ?? 0} />
            <Mini label="Ligação" value={today.por_tipo.ligacao ?? 0} />
          </div>
        </div>

        {/* Coluna 2: Série 7d */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Série diária — 7d ({week.total} total)
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              Média {Math.round(week.total / 7)}/dia
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {d.daily_series.map((s) => (
              <div key={s.date} className="text-center">
                <div className="h-20 flex items-end justify-center gap-0.5" title={`${s.date}: ${s.total}`}>
                  <div
                    className="w-2.5 bg-cyan-500/80 rounded-t"
                    style={{ height: `${(s.cadencia / maxDay) * 100}%` }}
                    title={`Cadência: ${s.cadencia}`}
                  />
                  <div
                    className="w-2.5 bg-emerald-500/80 rounded-t"
                    style={{ height: `${(s.prospeccao / maxDay) * 100}%` }}
                    title={`Prospecção: ${s.prospeccao}`}
                  />
                </div>
                <div className="text-[9px] mt-1 text-muted-foreground">
                  {s.date.slice(5)}
                </div>
                <div className="text-[10px] font-semibold tabular-nums">{s.total}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-cyan-500" /> Cadência
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-emerald-500" /> Prospecção
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-white/[0.03] px-2 py-1.5">
      <div className="text-[9px] uppercase text-muted-foreground/70">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}