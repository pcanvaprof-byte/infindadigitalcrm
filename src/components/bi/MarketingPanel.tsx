import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Users, Target, Repeat, TrendingUp, AlertTriangle } from "lucide-react";

const fmtBRL = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

type Props = {
  custoMarketing: number;
  receitaRealizada: number;
  cac: number;
  ltv: number;
  roi: number;
  paybackMeses: number;
  clientesAtivos: number;
  ticketMedio: number;
};

export function MarketingPanel({
  custoMarketing, receitaRealizada, cac, ltv, roi, paybackMeses, clientesAtivos, ticketMedio,
}: Props) {
  // ROAS = receita / custo de marketing (x)
  const roas = custoMarketing > 0 ? receitaRealizada / custoMarketing : 0;
  // LTV:CAC ratio — saudável >= 3
  const ltvCac = cac > 0 ? ltv / cac : 0;

  const roasTone = roas >= 4 ? "text-emerald-400" : roas >= 2 ? "text-amber-400" : "text-rose-400";
  const roiTone = roi >= 200 ? "text-emerald-400" : roi >= 100 ? "text-amber-400" : "text-rose-400";
  const ratioTone = ltvCac >= 3 ? "text-emerald-400" : ltvCac >= 1.5 ? "text-amber-400" : "text-rose-400";
  const paybackTone = paybackMeses <= 6 ? "text-emerald-400" : paybackMeses <= 12 ? "text-amber-400" : "text-rose-400";

  const ratioPct = Math.max(0, Math.min(100, (ltvCac / 5) * 100)); // escala visual 0–5

  return (
    <div className="space-y-5">
      {/* Hero ROI/ROAS */}
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="p-6 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
              <Megaphone className="h-3.5 w-3.5" /> Eficiência de marketing
            </div>
            <div className="mt-3 flex items-baseline gap-3 flex-wrap">
              <span className={`text-3xl font-semibold ${roasTone}`}>{roas.toFixed(2)}x</span>
              <span className="text-sm text-muted-foreground">ROAS · cada R$1 investido retorna {fmtBRL(roas)}</span>
              <Badge variant="secondary" className={roiTone}>ROI {Math.round(roi)}%</Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Receita <strong className="text-foreground">{fmtBRL(receitaRealizada)}</strong> · investimento <strong className="text-foreground">{fmtBRL(custoMarketing)}</strong>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 content-start">
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Investimento</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(custoMarketing)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Receita gerada</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(receitaRealizada)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* CAC */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> CAC
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{fmtBRL(cac)}</span>
              <span className="text-xs text-muted-foreground">por cliente</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Custo médio de aquisição (custo MKT ÷ novos clientes do mês).
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Ticket médio</p>
                <p className="font-medium text-foreground">{fmtBRL(ticketMedio)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Clientes ativos</p>
                <p className="font-medium text-foreground">{clientesAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LTV */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> LTV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{fmtBRL(ltv)}</span>
              <span className="text-xs text-muted-foreground">por cliente</span>
            </div>
            <p className="text-xs text-muted-foreground">Valor projetado por cliente em 12 meses.</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Receita total</p>
                <p className="font-medium text-foreground">{fmtBRL(ltv * clientesAtivos)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Base</p>
                <p className="font-medium text-foreground">{clientesAtivos} clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payback */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" /> Payback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-semibold ${paybackTone}`}>{paybackMeses.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">meses para recuperar CAC</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Saudável ≤ 6 meses · atenção 6–12 · crítico &gt; 12.
            </p>
            {paybackMeses > 12 && (
              <div className="flex items-start gap-2 text-xs text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                <span>Investimento demora a retornar — revisar canais e ticket.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* LTV:CAC */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Razão LTV : CAC
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className={`text-3xl font-semibold ${ratioTone}`}>{ltvCac.toFixed(2)}x</span>
            <Badge variant="secondary" className={ratioTone}>
              {ltvCac >= 3 ? "Saudável" : ltvCac >= 1.5 ? "Atenção" : "Crítico"}
            </Badge>
            <span className="text-xs text-muted-foreground">Ideal ≥ 3.0x</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className={`h-full rounded-full ${ltvCac >= 3 ? "bg-emerald-500" : ltvCac >= 1.5 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${ratioPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
            <span>0x</span><span>1.5x</span><span>3x</span><span>5x+</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Cada cliente vale <strong className="text-foreground">{ltvCac.toFixed(1)}x</strong> o que custou para adquirir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}