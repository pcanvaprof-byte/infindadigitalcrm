import { Sparkles, DollarSign, TrendingUp, Target } from "lucide-react";
import { brl, type VMCrescimento, type VMHeader, type VMROI } from "@/lib/proposta/viewModel";

interface Props {
  header: VMHeader;
  crescimento?: VMCrescimento | null;
  roi?: VMROI;
}

export function HeroSection({ header, crescimento, roi }: Props) {
  const esperado = crescimento?.cenarios.find((c) => c.nome === "Esperado") ?? crescimento?.cenarios[1];
  const receitaPotencial = esperado?.faturamento180 ?? roi?.faturamentoAdicional ?? null;
  const novosClientes = esperado?.novosClientes180 ?? null;
  const roiX = esperado?.roi180 ?? null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-10 ring-1 ring-primary/20 shadow-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--color-primary-glow)_0%,_transparent_55%)] opacity-30" aria-hidden />
      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">
            <Sparkles className="size-3.5" />
            Proposta comercial · {header.numero}
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl xl:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
            Transformamos estratégia em <span className="text-primary-glow">crescimento</span> previsível.
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
            Soluções completas em tecnologia, marketing e automação para gerar mais oportunidades,
            vendas e resultados reais.
          </p>
          <p className="mt-6 text-sm md:text-base">
            Preparada para <span className="text-foreground font-semibold">{header.cliente.nome}</span>
            {header.cliente.contato ? <span className="text-muted-foreground"> · {header.cliente.contato}</span> : null}
          </p>
          {(header.cliente.segmento || header.cliente.cidade) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {[header.cliente.segmento, header.cliente.cidade].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-background/40 ring-1 ring-primary/30 p-6 md:p-7 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary-glow font-semibold">
            Resultado que você pode esperar
          </div>
          <p className="mt-2 text-2xl md:text-3xl font-bold leading-tight">
            Mais visibilidade.<br />Mais leads. Mais vendas.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <StatPill
              icon={<DollarSign className="size-4" />}
              label="Receita potencial"
              value={receitaPotencial ? `+ ${brl(receitaPotencial)}` : "+ alto"}
              sub="em 6 meses"
            />
            <StatPill
              icon={<TrendingUp className="size-4" />}
              label="Leads qualificados"
              value={novosClientes ? `~ ${novosClientes}` : "+ 350%"}
              sub={novosClientes ? "novos clientes" : "em geração"}
            />
            <StatPill
              icon={<Target className="size-4" />}
              label="Retorno projetado"
              value={roiX ? `${roiX.toFixed(1)}x` : "+ 2,5x"}
              sub="média esperada"
            />
          </div>

          <p className="mt-4 text-[10px] text-muted-foreground/80">
            *Projeção baseada em empresas do mesmo segmento. Não constitui garantia de resultado.
          </p>
        </div>
      </div>
    </section>
  );
}

function StatPill({
  icon, label, value, sub,
}: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/20 text-primary-glow ring-1 ring-primary/40">
        {icon}
      </div>
      <div className="mt-2 text-[9px] uppercase tracking-wider text-primary-glow font-semibold">{label}</div>
      <div className="mt-1 text-base md:text-lg font-bold tracking-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}