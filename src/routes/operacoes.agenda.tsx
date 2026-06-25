import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { OperacoesLayout } from "@/modules/operacoes/components/OperacoesLayout";
import { PlaceholderTab } from "@/modules/operacoes/components/PlaceholderTab";

export const Route = createFileRoute("/operacoes/agenda")({
  ssr: false,
  head: () => ({ meta: [{ title: "Operações · Agenda — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Operações" subtitle="Agenda">
        <OperacoesLayout>
          <PlaceholderTab
            title="Agenda integrada da operação"
            description="Reuniões de cliente, gravações, sprints de criativo e datas de relatório em uma agenda compartilhada — sincronizada com Google Calendar."
            bullets={[
              "Visão semanal e mensal por cliente",
              "Sincronização com Google Calendar",
              "Lembrete automático de relatórios mensais",
              "Agendamento público de reuniões",
            ]}
          />
        </OperacoesLayout>
      </AppShell>
    </RequireAuth>
  ),
});