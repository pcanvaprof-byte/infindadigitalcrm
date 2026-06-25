import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { PlaceholderTab } from "@/modules/operacoes/components/PlaceholderTab";

export const Route = createFileRoute("/operacoes/relatorios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Relatórios — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Relatórios">
        <OperacoesLayout>
          <PlaceholderTab
            title="Relatórios automáticos por cliente"
            description="Geração mensal de relatórios de performance com white-label INFINDA, exportação em PDF e envio automático por e-mail/WhatsApp."
            bullets={[
              "Templates de relatório por serviço",
              "Importação de métricas das plataformas",
              "Comentários do gestor de tráfego",
              "Envio agendado para o cliente",
            ]}
          />
        </OperacoesLayout>
      </AppShell>
    </RequireAuth>
  ),
});