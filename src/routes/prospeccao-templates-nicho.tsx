import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota antiga — os templates por nicho foram unificados dentro de /cadencia
// (aba Templates). Redireciona para a nova localização mantendo bookmarks.
export const Route = createFileRoute("/prospeccao-templates-nicho")({
  beforeLoad: () => {
    throw redirect({ to: "/cadencia" });
  },
  component: () => null,
});