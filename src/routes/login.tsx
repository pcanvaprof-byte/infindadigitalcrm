import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — INFINDA" },
      { name: "description", content: "Acesse a plataforma INFINDA." },
    ],
  }),
  component: () => <Navigate to="/dashboard" replace />,
});
