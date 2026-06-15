import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth, SEED_ACCOUNTS } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ShieldCheck, BarChart3, ShieldUser, UserRound } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — INFINDA" },
      { name: "description", content: "Acesse a plataforma INFINDA — CRM + IA + Automação Comercial." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, loginAs } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await login(email, password);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  };

  const quickLogin = async (idx: number) => {
    const a = SEED_ACCOUNTS[idx];
    await loginAs({ name: a.name, email: a.email, role: a.role });
    toast.success(`Entrando como ${a.name}…`);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-10"
        style={{ background: "var(--gradient-surface)" }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "var(--gradient-glow)" }} />
        <div className="relative">
          <Logo size={40} />
        </div>
        <div className="relative space-y-6">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            O sistema operacional <span className="text-gradient">comercial</span> da sua empresa.
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            CRM, prospecção, metas, propostas e IA em uma única plataforma. Construído para
            equipes que vendem todo dia.
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
              />
            </div>
            <Button type="submit" className="btn-gradient h-11 w-full text-sm font-semibold">
              Entrar na plataforma
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Acesso rápido (MVP)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start gap-3 text-sm"
              onClick={() => quickLogin(0)}
            >
              <ShieldUser className="h-4 w-4 text-primary-glow" />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-semibold">Danielly</span>
                <span className="text-[11px] text-muted-foreground">Administradora</span>
              </div>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-start gap-3 text-sm"
              onClick={() => quickLogin(1)}
            >
              <UserRound className="h-4 w-4 text-primary-glow" />
              <div className="flex flex-col items-start leading-tight">
                <span className="font-semibold">Valdinei</span>
                <span className="text-[11px] text-muted-foreground">Consultor Comercial</span>
              </div>
            </Button>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Credenciais: <span className="font-mono">danielly@infinda.com / danielly123</span> ·{" "}
            <span className="font-mono">valdinei@infinda.com / valdinei123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
