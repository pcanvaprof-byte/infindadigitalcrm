import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, QrCode, Rocket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveOrg } from "@/lib/org/plans";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useServerFn } from "@tanstack/react-start";
import { convertDemoToPaid } from "@/lib/access/demo.functions";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura — INFINDA" },
      { name: "description", content: "Gerencie a assinatura da sua organização INFINDA." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
        <AssinaturaPage />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
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
  const { data: access } = useAccessStatus();
  const isDemo = access?.access_type === "demo";
  const convertFn = useServerFn(convertDemoToPaid);
  const queryClient = useQueryClient();
  const [converting, setConverting] = useState(false);
  const PIX_KEY = "financeiro@infinda.com.br";
  const copyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    toast.success("Chave PIX copiada");
  };
  const handleActivate = async () => {
    setConverting(true);
    try {
      await convertFn({});
      toast.success("Assinatura ativada! Todos os seus dados foram preservados.");
      await queryClient.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao ativar assinatura");
    } finally {
      setConverting(false);
    }
  };
  return (
    <AppShell title="Assinatura" subtitle="Plano único INFINDA — todos os módulos liberados">
      <div className="mx-auto grid max-w-4xl gap-6">
        {isDemo && (
          <section className="surface-card space-y-4 border border-primary/40 bg-primary/5 p-6">
            <div className="flex items-start gap-3">
              <Rocket className="mt-1 h-5 w-5 text-primary-glow" />
              <div>
                <h3 className="text-lg font-semibold">Gostou da Infinda?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Continue exatamente de onde parou por apenas <span className="font-semibold text-foreground">R$ 200/mês</span>.
                  Todos os dados que você criou durante a demonstração ficam preservados.
                </p>
              </div>
            </div>
            <div className="rounded-md border border-border bg-background/60 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Como funciona:</strong> pague via PIX na chave abaixo, clique em
              &nbsp;<em>“Já paguei — ativar assinatura”</em> e sua organização demo é convertida em real imediatamente.
              O time financeiro confirma o pagamento em até 1 dia útil.
            </div>
            <Button onClick={handleActivate} disabled={converting} className="btn-gradient w-full sm:w-auto">
              {converting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
              Já paguei — ativar assinatura
            </Button>
          </section>
        )}
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
            <Button className="gap-2" onClick={copyPix}>
              <Copy className="h-4 w-4" />
              Copiar chave PIX
            </Button>
            <Button variant="outline">Falar com o financeiro</Button>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <QrCode className="h-4 w-4 text-primary-glow" />
              Pagamento via PIX (manual)
            </div>
            <p className="text-sm text-muted-foreground">
              A cobrança de <span className="font-medium text-foreground">R$ 200/mês</span> é feita manualmente por PIX.
              Envie o comprovante para o time financeiro após o pagamento — a renovação é confirmada em até 1 dia útil.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Chave PIX (e-mail)</p>
                <p className="text-sm font-medium">{PIX_KEY}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={copyPix} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground">
          Precisa de ajuda com cobrança? Fale com o suporte INFINDA.
        </p>
      </div>
    </AppShell>
  );
}