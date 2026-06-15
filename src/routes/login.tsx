import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLoadingScreen, useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ShieldCheck, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — INFINDA" },
      {
        name: "description",
        content: "Acesse a plataforma INFINDA — CRM + IA + Automação Comercial.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, isReady, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      toast.error("Informe email e senha para entrar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await login(email, password);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-10"
        style={{ background: "var(--gradient-surface)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--gradient-glow)" }}
        />
        <div className="relative">
          <Logo size={40} />
        </div>
        <div className="relative space-y-6">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            O sistema operacional <span className="text-gradient">comercial</span> da sua empresa.
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            CRM, prospecção, metas, propostas e IA em uma única plataforma. Construído para equipes
            que vendem todo dia.
          </p>
          <ul className="grid gap-3 text-sm">
            {[
              { icon: BarChart3, text: "Dashboard executivo em tempo real" },
              { icon: Sparkles, text: "IA que qualifica leads e cria tarefas" },
              { icon: ShieldCheck, text: "Multi-tenant seguro e escalável" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-accent">
                  <Icon className="h-4 w-4 text-primary-glow" />
                </span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} Infinda Mídias Digitais. Todos os direitos reservados.
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo size={36} />
          </div>

          <h1 className="text-2xl font-bold">Acesse sua conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com seu email e senha para continuar.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@infinda.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className="btn-gradient h-11 w-full text-sm font-semibold"
            >
              {submitting ? "Entrando…" : "Entrar na plataforma"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
