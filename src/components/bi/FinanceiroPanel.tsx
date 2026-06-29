import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Wallet, PieChart, Repeat, ArrowUpRight, ArrowDownRight, Receipt } from "lucide-react";

const fmtBRL = (n: number | null | undefined) =>
  (Number.isFinite(n as number) ? (n as number) : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

type Props = {
  mrr: number;
  arr: number;
  receitaRealizada: number;
  receitaPrevistaMes: number;
  custoMarketing: number;
  ticketMedio: number;
  pipelineAberto: number;
  previsao30d: number;
  previsao90d: number;
  folha?: number;
  infra?: number;
  veiculos?: number;
  outros?: number;
  taxasPct?: number;
  expensesSource?: "expenses" | "goals";
};

export function FinanceiroPanel({
  mrr, arr, receitaRealizada, receitaPrevistaMes,
  custoMarketing, ticketMedio, pipelineAberto, previsao30d, previsao90d,
  folha = 0, infra = 0, veiculos = 0, outros = 0, taxasPct = 0, expensesSource = "goals",
}: Props) {
  // Lucro operacional = Receita - (Marketing + Pessoal + Infra + Veículos + Outros + Impostos)
  const impostos = receitaRealizada * (Math.max(0, taxasPct) / 100);
  const despesasOpex = folha + infra + veiculos + outros;
  const opex = custoMarketing + despesasOpex + impostos;
  const lucroReal = receitaRealizada - opex;
  const despesasTotal = despesasOpex;
  const lucroPct = receitaRealizada > 0 ? (lucroReal / receitaRealizada) * 100 : 0;

  // Crescimento previsto (próximos 30d vs realizado mês corrente)
  const crescimentoPct = receitaRealizada > 0
    ? ((previsao30d - receitaRealizada) / receitaRealizada) * 100
    : 0;

  // Fluxo de caixa previsto (90 dias) — previsao_90d já é o total dos próximos 90 dias.
  // Realizado é o que já entrou. Para evitar dupla contagem, somamos apenas
  // realizado + previsto incremental dos 60d além dos primeiros 30d.
  const incremento60a90 = Math.max(0, previsao90d - previsao30d);
  const fluxoCaixa90d = receitaRealizada + previsao30d + incremento60a90;

  const lucroTone = lucroPct >= 30 ? "text-emerald-400" : lucroPct >= 10 ? "text-amber-400" : "text-rose-400";
  const crescTone = crescimentoPct >= 0 ? "text-emerald-400" : "text-rose-400";

  return (
    <div className="space-y-5">
      {/* Hero financeiro: MRR / ARR */}
      <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-card">
        <CardContent className="p-6 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-emerald-400/90">
              <Repeat className="h-3.5 w-3.5" /> Receita recorrente
            </div>
            <div className="mt-3 flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-semibold">{fmtBRL(mrr)}</span>
              <span className="text-sm text-muted-foreground">MRR · {fmtBRL(arr)} ARR</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Base mensal previsível · ticket médio <strong className="text-foreground">{fmtBRL(ticketMedio)}</strong>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 content-start">
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Realizado mês</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(receitaRealizada)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Previsto mês</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(receitaPrevistaMes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Lucro real */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" /> Lucro real
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">
              Receita − (Marketing + Pessoal + Infra + Veículos + Outros + Impostos)
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-semibold ${lucroTone}`}>{lucroPct.toFixed(1)}%</span>
              <Badge variant="secondary" className={lucroTone}>{fmtBRL(lucroReal)}</Badge>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                style={{ width: `${Math.max(0, Math.min(100, lucroPct))}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Receita</p>
                <p className="font-medium text-foreground">{fmtBRL(receitaRealizada)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Marketing</p>
                <p className="font-medium text-foreground">{fmtBRL(custoMarketing)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2 col-span-2">
                <p className="text-muted-foreground">Despesas operacionais</p>
                <p className="font-medium text-foreground">{fmtBRL(despesasTotal)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2 col-span-2">
                <p className="text-muted-foreground">Impostos ({taxasPct.toFixed(1)}%)</p>
                <p className="font-medium text-foreground">{fmtBRL(impostos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Crescimento previsto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Crescimento previsto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-semibold ${crescTone}`}>{fmtPct(crescimentoPct)}</span>
              {crescimentoPct >= 0
                ? <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                : <ArrowDownRight className="h-5 w-5 text-rose-400" />}
            </div>
            <p className="text-xs text-muted-foreground">Próximos 30 dias vs mês corrente</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Atual</p>
                <p className="font-medium text-foreground">{fmtBRL(receitaRealizada)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Próx. 30d</p>
                <p className="font-medium text-foreground">{fmtBRL(previsao30d)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fluxo de caixa previsto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Fluxo de caixa 90d
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{fmtBRL(fluxoCaixa90d)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Realizado + previsão dos próximos 90 dias</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">Realizado</p>
                <p className="font-medium text-foreground">{fmtBRL(receitaRealizada)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">30d</p>
                <p className="font-medium text-foreground">{fmtBRL(previsao30d)}</p>
              </div>
              <div className="rounded border border-border/60 bg-card/40 p-2">
                <p className="text-muted-foreground">90d</p>
                <p className="font-medium text-foreground">{fmtBRL(previsao90d)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline aberto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" /> Pipeline financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Em aberto</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(pipelineAberto)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">MRR</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(mrr)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">ARR</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(arr)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ticket médio</p>
              <p className="mt-1 text-xl font-semibold">{fmtBRL(ticketMedio)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Despesas operacionais — fonte: bi.expenses */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Despesas operacionais
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">
              {expensesSource === "expenses"
                ? "Fonte: Business › Configurações Operacionais"
                : "Fonte: metas (sem despesas cadastradas)"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total recorrente</p>
            <p className="text-xl font-semibold tabular-nums">{fmtBRL(despesasTotal)}</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pessoal</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtBRL(folha)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Veículos</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtBRL(veiculos)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Infra</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtBRL(infra)}</p>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outros</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{fmtBRL(outros)}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/90">Lucro operacional previsto</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">{fmtBRL(lucroReal)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Receita {fmtBRL(receitaRealizada)} − Marketing {fmtBRL(custoMarketing)} − Despesas {fmtBRL(despesasTotal)} − Impostos {fmtBRL(impostos)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}