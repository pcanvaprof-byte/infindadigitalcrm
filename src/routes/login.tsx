import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { BarChart3, Loader2, Rocket, Shield, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION } from "@/lib/version";
import { startDemo } from "@/lib/access/demo.functions";

export const Route = createFileRoute("/login")({
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
  component: LoginPage,
});

function LoginPage() {
  const { redirect, reason } = Route.useSearch();

  return <AuthPageContent redirect={redirect} reason={reason} />;
}

export function AuthPageContent({ redirect, reason }: { redirect?: string; reason?: string }) {
  const navigate = useNavigate();
  const { user, isReady, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [demoPass, setDemoPass] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const startDemoFn = useServerFn(startDemo);

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

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthErr) {
        setError(oauthErr.message);
        setGoogleLoading(false);
      }
      // Em caso de sucesso o browser é redirecionado ao Google.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar o login com Google.",
      );
      setGoogleLoading(false);
    }
  };

  const handleStartDemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setDemoLoading(true);
    try {
      const result = await startDemoFn({
        data: {
          fullName: demoName.trim() || undefined,
          email: demoEmail.trim(),
          password: demoPass,
        },
      });
      // Já provisionado — faz login automático com as credenciais retornadas.
      const loginRes = await login(result.email, demoPass || (result as { password?: string }).password || "");
      if (!loginRes.ok) {
        setError(loginRes.error);
        setDemoLoading(false);
        return;
      }
      await navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ativar demo.");
      setDemoLoading(false);
    }
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
                Entre com Google para liberar 2 horas de teste grátis, ou use seu
                email e senha se já tiver conta.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="h-11 w-full text-base"
              onClick={handleGoogle}
              disabled={googleLoading || submitting}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <GoogleIcon className="mr-2 h-4 w-4" />
                  Continuar com Google — 2h grátis
                </>
              )}
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Ambiente real, sua base de dados. Sem cartão de crédito.
            </p>

            <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
              <button
                type="button"
                onClick={() => setDemoOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left text-xs font-medium text-primary"
              >
                <span className="flex items-center gap-1.5">
                  <Rocket className="h-3.5 w-3.5" />
                  Ou libere 2h de demo com email e senha
                </span>
                <span aria-hidden>{demoOpen ? "−" : "+"}</span>
              </button>
              {demoOpen && (
                <form onSubmit={handleStartDemo} className="mt-3 space-y-2">
                  <Input
                    type="text"
                    placeholder="Seu nome"
                    value={demoName}
                    onChange={(e) => setDemoName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={demoEmail}
                    onChange={(e) => setDemoEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Crie uma senha (mín. 8)"
                    value={demoPass}
                    onChange={(e) => setDemoPass(e.target.value)}
                    minLength={8}
                    autoComplete="new-password"
                    required
                  />
                  <Button
                    type="submit"
                    className="btn-gradient h-10 w-full text-sm"
                    disabled={demoLoading}
                  >
                    {demoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar demo de 2 horas"}
                  </Button>
                </form>
              )}
            </div>

            <div className="my-5 relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">
                  ou entrar com email
                </span>
              </div>
            </div>

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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.3 12 2.3 6.9 2.3 2.8 6.5 2.8 12S6.9 21.7 12 21.7c6.9 0 9.6-4.8 9.6-9.4 0-.6-.1-1.1-.2-1.5H12z"/>
    </svg>
  );
}
