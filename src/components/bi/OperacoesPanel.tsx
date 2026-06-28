import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge, ShieldAlert, Zap, HeartPulse, Activity } from "lucide-react";

type Stage = { stage: string; clientes: number; tempo_medio_dias: number };
type Churn = { alto: number; medio: number; baixo: number } | undefined;

type Props = {
  funnel: Stage[];
  churn: Churn;
  clientesAtivos: number;
  receitaRealizada: number;
  receitaPrevistaMes: number;
  taxaConversaoHistorica: number | null;
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

export function OperacoesPanel({
  funnel, churn, clientesAtivos, receitaRealizada, receitaPrevistaMes, taxaConversaoHistorica,
}: Props) {
  // ===== INFINDA SCORE 0-100 (composto) =====
  // 1. Saúde do funil: 100 - maior queda entre estágios
  let funnelScore = 70;
  let gargalo: { from: string; to: string; drop: number } | null = null;
  for (let i = 0; i < funnel.length - 1; i++) {
    const a = funnel[i].clientes;
    const b = funnel[i + 1].clientes;
    if (a > 0) {
      const drop = ((a - b) / a) * 100;
      if (!gargalo || drop > gargalo.drop) {
        gargalo = { from: funnel[i].stage, to: funnel[i + 1].stage, drop };
      }
    }
  }
  if (gargalo) funnelScore = clamp(100 - gargalo.drop * 0.8);

  // 2. Conversão histórica (peso para conversão >= 15% = 100)
  const convScore = clamp(((taxaConversaoHistorica ?? 0) / 15) * 100);

  // 3. Saúde de churn: % de clientes em risco baixo
  const totalChurn = (churn?.alto ?? 0) + (churn?.medio ?? 0) + (churn?.baixo ?? 0);
  const churnScore = totalChurn > 0
    ? clamp(((churn!.baixo) / totalChurn) * 100)
    : 75;

  // 4. Aderência de previsão (realizado vs previsto)
  const aderencia = receitaPrevistaMes > 0
    ? clamp((receitaRealizada / receitaPrevistaMes) * 100)
    : 50;

  const score = Math.round(
    funnelScore * 0.30 +
    convScore * 0.25 +
    churnScore * 0.25 +
    aderencia * 0.20
  );

  const tone = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  const tier = score >= 80 ? "Excelente" : score >= 60 ? "Saudável" : score >= 40 ? "Atenção" : "Crítico";
  const ringStop = clamp(score);

  return (
    <div className="space-y-5">
      {/* INFINDA SCORE Hero */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="p-6 grid gap-6 md:grid-cols-[1fr_1.4fr] items-center">
          <div className="flex items-center gap-5">
            <div
              className="relative h-32 w-32 rounded-full grid place-items-center"
              style={{
                background: `conic-gradient(currentColor ${ringStop * 3.6}deg, hsl(var(--muted) / 0.4) 0deg)`,
              }}
            >
              <div className="absolute inset-2 rounded-full bg-card grid place-items-center">
                <div className="text-center">
                  <div className={`text-3xl font-semibold ${tone}`}>{score}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">/ 100</div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
                <Gauge className="h-3.5 w-3.5" /> INFINDA Score
              </div>
              <p className={`mt-2 text-xl font-semibold ${tone}`}>{tier}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Indicador proprietário de saúde operacional
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ScoreBar label="Saúde do funil" value={funnelScore} icon={Activity} />
            <ScoreBar label="Conversão histórica" value={convScore} icon={Zap} />
            <ScoreBar label="Retenção (churn)" value={churnScore} icon={HeartPulse} />
            <ScoreBar label="Aderência ao plano" value={aderencia} icon={ShieldAlert} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Gargalo do funil */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Gargalo operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gargalo ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold text-rose-400">{gargalo.drop.toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground">de queda</span>
                </div>
                <p className="text-sm">
                  Entre <strong>{gargalo.from}</strong> e <strong>{gargalo.to}</strong>
                </p>
                <p className="text-xs text-muted-foreground">
                  Maior perda de leads do pipeline — priorizar revisão deste estágio.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados de funil suficientes.</p>
            )}
          </CardContent>
        </Card>

        {/* Saúde da base */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" /> Saúde da base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded border border-rose-500/30 bg-rose-500/5 p-3">
                <p className="text-rose-400 font-medium">Alto risco</p>
                <p className="text-2xl font-semibold mt-1">{churn?.alto ?? 0}</p>
              </div>
              <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-amber-400 font-medium">Médio</p>
                <p className="text-2xl font-semibold mt-1">{churn?.medio ?? 0}</p>
              </div>
              <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-3">
                <p className="text-emerald-400 font-medium">Saudável</p>
                <p className="text-2xl font-semibold mt-1">{churn?.baixo ?? 0}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Base ativa: <strong className="text-foreground">{clientesAtivos}</strong> clientes
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ScoreBar({ label, value, icon: Icon }:
  { label: string; value: number; icon: typeof Activity }) {
  const v = clamp(Math.round(value));
  const tone = v >= 80 ? "bg-emerald-500" : v >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Icon className="h-3 w-3" />{label}</span>
        <span className="tabular-nums font-medium text-foreground">{v}</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}