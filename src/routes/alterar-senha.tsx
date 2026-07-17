import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { markPasswordChanged } from "@/lib/access/access.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/alterar-senha")({
  component: AlterarSenhaPage,
});

function AlterarSenhaPage() {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const markChanged = useServerFn(markPasswordChanged);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (isReady && !user) {
    void navigate({ to: "/login", replace: true });
    return null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (next !== confirm) {
      toast.error("A confirmação não confere.");
      return;
    }
    setBusy(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: current,
      });
      if (signInErr) throw new Error("Senha atual incorreta.");

      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) throw new Error(updErr.message);

      await markChanged();
      await queryClient.invalidateQueries({ queryKey: ["access-status"] });
      toast.success("Senha alterada com sucesso.");
      await navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alterar a senha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <h1 className="text-center text-xl font-semibold">Bem-vindo(a) à plataforma</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Por segurança, altere sua senha para continuar.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current">Senha atual (temporária)</Label>
            <Input id="current" type="password" autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next">Nova senha</Label>
            <Input id="next" type="password" autoComplete="new-password"
              value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input id="confirm" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} required />
          </div>
        </div>
        <Button type="submit" className="mt-6 w-full" disabled={busy}>
          {busy ? "Alterando…" : "Alterar senha"}
        </Button>
      </form>
    </div>
  );
}