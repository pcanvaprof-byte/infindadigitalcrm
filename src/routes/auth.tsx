import { createFileRoute } from "@tanstack/react-router";

import { AuthPageContent } from "./login";

export const Route = createFileRoute("/auth")({
  validateSearch: (search): { redirect?: string; reason?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    reason: typeof search.reason === "string" ? search.reason : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — INFINDA" },
      { name: "description", content: "Acesse a plataforma INFINDA." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect, reason } = Route.useSearch();

  return <AuthPageContent redirect={redirect} reason={reason} />;
}