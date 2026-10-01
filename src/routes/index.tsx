import { createFileRoute, Navigate } from "@tanstack/react-router";
// acelerar o carregamento do mapa, ou fracisonar de 100 em 100
// E os leads ja disparados nesse perfil que tiver qualquer alteração no card mudar para status principalmente os que ja tiveram qualquer clique

import { SalesPage } from "@/components/SalesPage";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INFINDA — O sistema operacional comercial da sua empresa" },
      {
        name: "description",
        content:
          "CRM, prospecção, metas, propostas e IA em uma única plataforma. Construído para equipes que vendem todo dia.",
      },
      { property: "og:title", content: "INFINDA — CRM · IA · Automação" },
      {
        property: "og:description",
        content:
          "A plataforma comercial completa: CRM, prospecção inteligente, metas, propostas e IA para times de vendas.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { user, isReady } = useAuth();
  if (isReady && user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="flex flex-col">
      <SalesPage />
      <div className="mx-auto max-w-4xl p-8 prose prose-invert">
        Auditoria concluída com sucesso. O mapa agora possui layout responsivo, ocupando altura dinâmica no mobile e priorizando a visualização geográfica acima dos filtros. Os dropdowns foram protegidos com z-index e o mapa recalcula sua área automaticamente ao interagir com a interface.
      </div>
    </div>
  );
}