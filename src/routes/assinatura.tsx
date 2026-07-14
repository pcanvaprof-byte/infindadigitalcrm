import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard } from "lucide-react";
import { useActiveOrg } from "@/lib/org/plans";

export const Route = createFileRoute("/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura — INFINDA" },
      { name: "description", content: "Gerencie a assinatura da sua organização INFINDA." },
    ],
  }),
  component: AssinaturaPage,
});

const MODULOS = [
  "Dashboard e BI",
  "CRM Comercial completo",
  "Prospecção com IA",
  "Cadência multi-canal",
  "Operações e Onboarding",
  "Briefings comerciais",
  "Catálogo comercial",
  "Kickoff de produção",
  "Propostas e Contratos",
  "API pública + Chaves de API",
  "Usuários ilimitados",
  "Suporte premium",
];

function AssinaturaPage() {
  const { org } = useActiveOrg();
  return (
    <AppShell title="Assinatura" subtitle="Plano único INFINDA — todos os módulos liberados">
      <div className="mx-auto grid max-w-4xl gap-6">
        <section className="surface-card space-y-6 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Plano atual
              </p>
              <h2 className="mt-1 text-2xl font-semibold">INFINDA — Plano Completo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Organização: <span className="font-medium text-foreground">{org?.name ?? "—"}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tracking-tight">R$ 200<span className="text-base font-normal text-muted-foreground">/mês</span></p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ativa
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {MODULOS.map((m) => (
              <div key={m} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary-glow" />
                <span>{m}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
            <Button className="gap-2">
              <CreditCard className="h-4 w-4" />
              Atualizar pagamento
            </Button>
            <Button variant="outline">Cancelar assinatura</Button>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Precisa de ajuda com cobrança? Fale com o suporte INFINDA.
        </p>
      </div>
    </AppShell>
  );
}