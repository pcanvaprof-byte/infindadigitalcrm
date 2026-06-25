import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/operacoes/")({
  beforeLoad: () => {
    throw redirect({ to: "/operacoes/dashboard" });
  },
});