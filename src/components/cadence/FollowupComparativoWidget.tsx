import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, TrendingDown, TrendingUp, Equal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  dia: string;
  previstos: number;
  realizados: number;
  desvio: number;
  pct_aderencia: number | null;
};

async function fetchComparativo(days = 14): Promise<Row[]> {
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
  }).rpc("cadencia_followup_comparativo", { _days: days });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", weekday: "short" });
}

const DESVIO_ALERT = 3; // unidades absolutas para destacar dia

export function FollowupComparativoWidget() {
  const q = useQuery({
    queryKey: ["cadencia-followup-comparativo", 14],
    queryFn: () => fetchComparativo(14),
    staleTime: 60_000,
  });

  const { passado, hoje, futuro, totais } = useMemo(() => {
    const rows = q.data ?? [];
    const todayISO = new Date().toISOString().slice(0, 10);
    const passado = rows.filter((r) => r.dia < todayISO);
    const hoje = rows.find((r) => r.dia === todayISO) ?? null;
    const futuro = rows.filter((r) => r.dia > todayISO);
    const sum = (arr: Row[], k: "previstos" | "realizados") =>
      arr.reduce((acc, r) => acc + (r[k] ?? 0), 0);
    const previstos = sum(passado, "previstos");
    const realizados = sum(passado, "realizados");
    return {
      passado,
      hoje,
      futuro,
      totais: {
        previstos,
        realizados,
        desvio: realizados - previstos,
        aderencia: previstos > 0 ? (realizados / previstos) * 100 : null,
        diasComDesvio: passado.filter((r) => Math.abs(r.desvio) >= DESVIO_ALERT).length,
      },
    };
  }, [q.data]);

  const errMsg = q.error ? (q.error as Error).message : "";
  const migrationPending =
    errMsg.includes("cadencia_followup_comparativo") ||
    errMsg.includes("function") ||
    errMsg.includes("404");

  return (
    <section className="surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Follow-ups · Previsto × Realizado</h3>
          <p className="text-[11px] text-muted-foreground">
            Janela de 14 dias. Desvio ≥ {DESVIO_ALERT} é destacado.
          </p>
        </div>
        {!migrationPending && q.data && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">
              Previstos (passado): <b className="text-foreground tabular-nums">{totais.previstos}</b>
            </span>
            <span className="text-muted-foreground">
              Realizados: <b className="text-foreground tabular-nums">{totais.realizados}</b>
            </span>
            <span className="text-muted-foreground">
              Aderência:{" "}
              <b className="text-foreground tabular-nums">
                {totais.aderencia === null ? "—" : `${totais.aderencia.toFixed(1)}%`}
              </b>
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                totais.desvio >= 0
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {totais.desvio >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              Desvio {totais.desvio >= 0 ? "+" : ""}
              {totais.desvio}
            </span>
            {totais.diasComDesvio > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">
                <AlertTriangle className="h-3 w-3" /> {totais.diasComDesvio} dia(s) com desvio
              </span>
            )}
          </div>
        )}
      </div>

      {migrationPending ? (
        <p className="mt-4 text-xs text-amber-300">
          Migration pendente: aplique{" "}
          <code>scripts/migrations/20260718_cadencia_followup_comparativo.sql</code> no SQL Editor.
        </p>
      ) : q.isLoading ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : q.error ? (
        <p className="mt-4 text-xs text-rose-300">{errMsg}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2">Dia</th>
                <th className="py-2 text-right">Previstos</th>
                <th className="py-2 text-right">Realizados</th>
                <th className="py-2 text-right">Desvio</th>
                <th className="py-2 text-right">Aderência</th>
                <th className="py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...passado, ...(hoje ? [hoje] : []), ...futuro].map((r) => {
                const isToday = hoje?.dia === r.dia;
                const isFuture = r.dia > new Date().toISOString().slice(0, 10);
                const alerta = !isFuture && Math.abs(r.desvio) >= DESVIO_ALERT;
                const tone =
                  isFuture
                    ? "text-muted-foreground"
                    : r.desvio > 0
                      ? "text-emerald-300"
                      : r.desvio < 0
                        ? "text-rose-300"
                        : "text-muted-foreground";
                return (
                  <tr
                    key={r.dia}
                    className={`border-b border-border/40 last:border-0 ${
                      isToday ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="py-2">
                      {fmtDay(r.dia)}
                      {isToday && (
                        <span className="ml-2 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] uppercase text-primary-glow">
                          hoje
                        </span>
                      )}
                      {isFuture && (
                        <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[9px] uppercase text-muted-foreground">
                          previsto
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{r.previstos}</td>
                    <td className="py-2 text-right tabular-nums">
                      {isFuture ? "—" : r.realizados}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-semibold ${tone}`}>
                      {isFuture ? "—" : (r.desvio > 0 ? "+" : "") + r.desvio}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {isFuture || r.pct_aderencia === null ? "—" : `${r.pct_aderencia}%`}
                    </td>
                    <td className="py-2 text-right">
                      {isFuture ? (
                        <span className="text-muted-foreground">—</span>
                      ) : alerta ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          <AlertTriangle className="h-3 w-3" /> desvio
                        </span>
                      ) : r.desvio === 0 ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Equal className="h-3 w-3" /> ok
                        </span>
                      ) : (
                        <span className="text-muted-foreground">leve</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}