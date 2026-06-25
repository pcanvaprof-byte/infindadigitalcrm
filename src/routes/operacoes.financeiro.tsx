import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { PlaceholderTab } from "@/modules/operacoes/components/PlaceholderTab";

export const Route = createFileRoute("/operacoes/financeiro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Financeiro — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Financeiro">
        <OperacoesLayout>
          <PlaceholderTab
            title="Financeiro da operação"
            description="Mensalidades recorrentes, repasses de verba de tráfego, comissões e inadimplência consolidados no mesmo painel da plataforma."
            bullets={[
              "Contratos recorrentes vinculados ao cliente",
              "Repasse de verba de tráfego e taxa de gestão",
              "Boletos, Pix e cartão (gateway integrado)",
              "Relatório de DRE simples por cliente",
            ]}
          />
        </OperacoesLayout>
      </AppShell>
    </RequireAuth>
  ),
});