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
        For the code present, I get the error below.

        Please think step-by-step in order to resolve it.
        <pre className="bg-slate-900 p-4 rounded-lg overflow-auto text-xs">
{`Error: aborted

{
  "timestamp": 1787416315938,
  "error_type": "RUNTIME_ERROR",
  "filename": "Unknown file",
  "lineno": 0,
  "colno": 0,
  "stack": "Error: aborted\\n    at abortIncoming (node:_http_server:838:17)\\n    at socketOnClose (node:_http_server:832:3)\\n    at Socket.emit (node:events:531:35)\\n    at TCP.<anonymous> (node:net:346:12)\\n    at TCP.callbackTrampoline (node:internal/async_hooks:130:17)\",
  "has_blank_screen": true
}`}
        </pre>
      </div>
    </div>
  );
}
