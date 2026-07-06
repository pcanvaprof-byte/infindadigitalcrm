import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { BarChart3, Loader2, Shield, Sparkles } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { APP_VERSION } from "@/lib/version";

export const Route = createFileRoute("/login")({
  validateSearch: (search) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/dashboard",
    reason: typeof search.reason === "string" ? search.reason : undefined,
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
  const { redirect, reason } = Route.useSearch();

  return <AuthPageContent redirect={redirect} reason={reason} />;
}

export function AuthPageContent({ redirect, reason }: { redirect: string; reason?: string }) {
  const navigate = useNavigate();
  const { user, isReady, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isReady && user) {
    return <Navigate to={redirect || "/dashboard"} replace />;
  }

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");
    setSubmitting(true);

    const result = await login(loginEmail.trim(), loginPassword);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    await navigate({ to: redirect || "/dashboard", replace: true });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void performLogin(email, password);
  };

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <div className="grid min-h-[100dvh] lg:grid-cols-2">
        {/* Left: brand / pitch */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0b1426] via-[#0a1020] to-[#050811] p-10 lg:flex">
          <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.25), transparent 60%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.18), transparent 55%)" }} />
          <div className="relative z-10">
            <Logo size={40} />
          </div>
          <div className="relative z-10 max-w-md space-y-6">
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              O sistema operacional{" "}
              <span className="bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
                comercial
              </span>{" "}
              da sua empresa.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              CRM, prospecção, metas, propostas e IA em uma única plataforma. Construído para
              equipes que vendem todo dia.
            </p>
            <ul className="space-y-3 pt-2">
              {[
                { icon: BarChart3, text: "Dashboard executivo em tempo real" },
                { icon: Sparkles, text: "IA que qualifica leads e cria tarefas" },
                { icon: Shield, text: "Multi-tenant seguro e escalável" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-500/10 text-blue-400">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative z-10 text-xs text-muted-foreground">
            © 2026 Infinda Mídias Digitais. Todos os direitos reservados.
          </p>
        </aside>

        {/* Right: form */}
        <section className="flex items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <Logo />
            </div>

            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Acesse sua conta</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Entre com seu email e senha para continuar.
              </p>
            </div>

            {reason === "session" && (
              <p className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Sua sessão estava desatualizada. Entre novamente para continuar.
              </p>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="voce@infinda.com"
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
                  placeholder="••••••••"
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
                className="btn-gradient h-11 w-full text-base"
                disabled={submitting || !isReady}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Entrar na plataforma"
                )}
              </Button>
            </form>
            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              {APP_VERSION}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
