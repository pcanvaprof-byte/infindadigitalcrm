import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useOrgRole, isOwnerOrAdmin } from "@/lib/org/plans";

/**
 * Gate de rota: bloqueia membros (papel `member`) e redireciona para /dashboard.
 * Owner e admin passam. Enquanto carrega o papel, não renderiza nada
 * (evita flash de conteúdo restrito).
 *
 * A ocultação no menu é apenas UX; a autorização real vive nas policies RLS.
 * Este guard existe para impedir acesso direto por URL.
 */
export function RequireOwnerOrAdmin({ children }: { children: ReactNode }) {
  const { role, isLoading } = useOrgRole();
  if (isLoading) return null;
  if (!isOwnerOrAdmin(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}