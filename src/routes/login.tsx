import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLoadingScreen, useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
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
  const { user, isReady, loginWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await loginWithGoogle();
      if (!res.ok) {
        toast.error(res.error);
        setSubmitting(false);
      }
    } catch {
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
            Entre com sua conta Google para continuar.
          </p>

          <div className="mt-6 space-y-4">
            <Button
              type="button"
              onClick={handleGoogle}
              disabled={submitting}
              variant="outline"
              className="h-11 w-full text-sm font-semibold"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
              </svg>
              {submitting ? "Redirecionando…" : "Entrar com Google"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
