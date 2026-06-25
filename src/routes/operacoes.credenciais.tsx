import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { PlaceholderTab } from "@/modules/operacoes/components/PlaceholderTab";

export const Route = createFileRoute("/operacoes/credenciais")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Credenciais — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Credenciais">
        <OperacoesLayout>
          <PlaceholderTab
            title="Cofre de credenciais por cliente"
            description="Centralize logins, acessos a Business Manager, contas Google, domínios, hospedagem e ferramentas — com controle de quem pode visualizar."
            bullets={[
              "Cofre criptografado por cliente",
              "Integração com Meta Business e Google Ads",
              "Histórico de acessos e auditoria",
              "Compartilhamento por papel (admin, operador, designer)",
            ]}
          />
        </OperacoesLayout>
      </AppShell>
    </RequireAuth>
  ),
});