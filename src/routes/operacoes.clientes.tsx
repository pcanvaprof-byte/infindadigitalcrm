import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";

export const Route = createFileRoute("/operacoes/clientes")({
  ssr: false,
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
        <Outlet />
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});