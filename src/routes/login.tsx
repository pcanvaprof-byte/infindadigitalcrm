import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { Loader2, LogIn } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
  }),
  head: () => ({
    meta: [
      { title: "Entrar — INFINDA" },
      { name: "description", content: "Acesse a plataforma INFINDA." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { user, isReady, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isReady && user) {
    return <Navigate to={redirect || "/dashboard"} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const result = await login(email.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await navigate({ to: redirect || "/dashboard", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="surface-card p-5 sm:p-6">
          <div className="mb-5">
            <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta para continuar.</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="btn-gradient h-10 w-full"
              disabled={submitting || !isReady}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Entrar
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
