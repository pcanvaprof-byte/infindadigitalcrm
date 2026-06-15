import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AuthLoadingScreen, useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, isReady } = useAuth();
  if (!isReady) return <AuthLoadingScreen />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}
