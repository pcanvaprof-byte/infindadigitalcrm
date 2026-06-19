import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  LineChart,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Users,
    title: "CRM com pipeline visual",
    desc: "Clientes, deals e histórico em um Kanban rápido, focado em quem vende todo dia.",
  },
  {
    icon: MapPin,
    title: "Prospecção inteligente",
    desc: "Enriqueça leads por CNPJ, CEP e bairro com dados públicos e score automático.",
  },
  {
    icon: Brain,
    title: "IA que qualifica e age",
    desc: "Briefings, propostas e tarefas geradas por IA — menos digitação, mais fechamento.",
  },
  {
    icon: Target,
    title: "Metas e ranking",
    desc: "Acompanhe metas individuais e do time com indicadores em tempo real.",
  },
  {
    icon: ClipboardList,
    title: "Briefings e kickoff",
    desc: "Formulários inteligentes com link público para o cliente preencher em minutos.",
  },
  {
    icon: BarChart3,
    title: "Dashboard executivo",
    desc: "Visão clara de receita, pipeline, conversão e produtividade do time.",
  },
];

const benefits = [
  "Reduza 60% do tempo gasto em tarefas administrativas",
  "Centralize CRM, prospecção, propostas e metas em um só lugar",
  "IA integrada em todo o fluxo comercial, sem plugins externos",
  "Multi-tenant seguro, com controle de acesso por papel",
  "Implantação rápida: ative seu time em menos de uma semana",
];

export function SalesPage() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-sm">
                Entrar
              </Button>
            </Link>
            <a href="#contato">
              <Button size="sm" className="btn-gradient text-sm">
                Falar com vendas
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 10%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 70%), radial-gradient(50% 50% at 90% 30%, color-mix(in oklab, var(--primary-glow) 18%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:py-32">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              CRM · IA · Automação para times comerciais
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              O sistema operacional{" "}
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                comercial
              </span>{" "}
              da sua empresa.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              CRM, prospecção, metas, propostas e IA em uma única plataforma.
              Construído para equipes que vendem todo dia.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#contato">
                <Button size="lg" className="btn-gradient h-12 w-full text-base sm:w-auto">
                  Agendar demonstração
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full text-base sm:w-auto"
                >
                  Acessar plataforma
                </Button>
              </Link>
            </div>
            <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Implantação em dias, não meses
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Suporte humano + IA 24/7
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" /> Sem fidelidade — cancele quando quiser
              </li>
            </ul>
          </div>

          {/* Hero card mock */}
          <div className="relative">
            <div className="surface-card relative overflow-hidden p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Dashboard
                  </p>
                  <p className="text-sm font-semibold">Receita do mês</p>
                </div>
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                  +28%
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "Pipeline", value: "R$ 482k" },
                  { label: "Fechado", value: "R$ 127k" },
                  { label: "Meta", value: "R$ 150k" },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-secondary/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {m.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex h-32 items-end gap-2">
                {[40, 65, 50, 78, 60, 90, 72, 95, 80, 110, 88, 120].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary-glow/80"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </div>
              <div className="mt-5 space-y-2">
                {[
                  { name: "Acme Ltda", stage: "Proposta enviada", value: "R$ 18.400" },
                  { name: "Vértice S.A.", stage: "Negociação", value: "R$ 32.900" },
                  { name: "Norte Digital", stage: "Fechamento", value: "R$ 9.750" },
                ].map((d) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.stage}</p>
                    </div>
                    <p className="text-sm font-semibold">{d.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="border-t border-border/40 bg-card/30 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs uppercase tracking-[0.18em] text-primary">Plataforma</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Tudo que seu time comercial precisa, em um só lugar
            </h2>
            <p className="mt-4 text-muted-foreground">
              Pare de pular entre planilhas, CRMs antigos e chatbots avulsos. A INFINDA conecta o
              fluxo inteiro — do lead frio ao contrato assinado.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="surface-card group p-5 transition hover:border-primary/40"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary">Por que INFINDA</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Mais vendas, menos fricção operacional
            </h2>
            <p className="mt-4 text-muted-foreground">
              Construído lado a lado com gestores comerciais que cansaram de adaptar ferramentas
              genéricas. A INFINDA já vem com os processos certos prontos para usar.
            </p>
            <ul className="mt-6 space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Zap, title: "Setup em 1 semana", desc: "Importe leads e ative o time rápido." },
              { icon: ShieldCheck, title: "Multi-tenant seguro", desc: "Isolamento por empresa e papel." },
              { icon: LineChart, title: "Indicadores em tempo real", desc: "Decisões com dados quentes." },
              { icon: Brain, title: "IA nativa", desc: "Atende, qualifica e propõe por você." },
            ].map((c) => (
              <div key={c.title} className="surface-card p-5">
                <c.icon className="h-6 w-6 text-primary" />
                <p className="mt-3 text-sm font-semibold">{c.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="contato"
        className="relative overflow-hidden border-t border-border/40 py-20 sm:py-24"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pronto para profissionalizar seu comercial?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Agende uma demonstração de 30 minutos e veja a INFINDA rodando com dados parecidos com
            os da sua operação.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="mailto:contato@infinda.com?subject=Quero%20conhecer%20a%20INFINDA">
              <Button size="lg" className="btn-gradient h-12 w-full text-base sm:w-auto">
                Agendar demonstração
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a
              href="https://wa.me/5500000000000?text=Quero%20conhecer%20a%20INFINDA"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="lg" variant="outline" className="h-12 w-full text-base sm:w-auto">
                Falar no WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-xs text-muted-foreground">
            © 2026 Infinda Mídias Digitais. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}