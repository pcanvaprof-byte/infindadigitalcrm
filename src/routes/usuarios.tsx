import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { KeyRound, Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetMemberTempPassword } from "@/lib/access/access.functions";
import { useOrgRole, isOwnerOrAdmin } from "@/lib/org/plans";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [{ title: "Usuários — INFINDA" }],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { role } = useOrgRole();
  const reset = useServerFn(resetMemberTempPassword);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (role && !isOwnerOrAdmin(role)) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl p-8 text-center text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </AppShell>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const r = (await reset({ data: { email: email.trim(), requireChange: true } })) as {
        email: string;
        tempPassword: string;
      };
      setResult(r);
      toast.success("Senha temporária gerada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar senha.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gere uma nova senha temporária para um membro da sua organização. Ele será obrigado a
            alterá-la no próximo login.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <h2 className="text-base font-medium">Gerar senha temporária</h2>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail do usuário</Label>
            <Input
              id="email"
              type="email"
              autoComplete="off"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={busy}>
            {busy ? "Gerando…" : "Gerar nova senha temporária"}
          </Button>
        </form>

        {result && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <p className="text-sm text-muted-foreground">
              Senha temporária para <strong>{result.email}</strong>:
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-lg">
                {result.tempPassword}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Copie e envie ao usuário por um canal seguro. Ela só aparece agora — não é possível
              recuperá-la depois.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}