import { createFileRoute, Navigate } from "@tanstack/react-router";
// Preciso aquecer os 9k de leads de forma automatica

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
  return <SalesPage />;
}
