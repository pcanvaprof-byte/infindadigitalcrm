import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/operacoes/clientes")({
  ssr: false,
  component: () => <Outlet />,
});