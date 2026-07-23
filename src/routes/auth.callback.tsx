import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { claimDemoAccess } from "@/lib/access/demo.functions";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Concluindo login — INFINDA" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const claim = useServerFn(claimDemoAccess);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Aguarda a sessão vinda do provedor OAuth ser aplicada pelo Supabase.
      const deadline = Date.now() + 10_000;
      let hasSession = false;
      while (Date.now() < deadline) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          hasSession = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (cancelled) return;
      if (!hasSession) {
        setError("Não conseguimos concluir o login. Tente novamente.");
        return;
      }

      try {
        await claim({});
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Falha ao ativar sua conta demo.",
        );
        return;
      }

      if (cancelled) return;
      await navigate({ to: "/dashboard", replace: true });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [claim, navigate]);

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background px-6 text-center">
      {error ? (
        <div className="max-w-md space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <a
            href="/login"
            className="text-sm underline underline-offset-4"
          >
            Voltar para o login
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Preparando sua área demo…
          </p>
        </div>
      )}
    </main>
  );
}