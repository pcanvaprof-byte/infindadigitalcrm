import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Rocket, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAccessStatus } from "@/hooks/useAccessStatus";

export function AccessExpiredScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: access } = useAccessStatus();
  const isDemo = access?.access_type === "demo";

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/login", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          {isDemo ? <Rocket className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
        </div>
        <h1 className="text-xl font-semibold">
          {isDemo ? "Gostou da Infinda?" : "Acesso expirado"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isDemo
            ? "Continue exatamente de onde parou por apenas R$ 200/mês. Todos os dados que você criou nestas 2 horas ficam preservados."
            : "Seu período de utilização da plataforma expirou. Entre em contato com o administrador para renovar seu acesso."}
        </p>
        {isDemo && (
          <Button
            onClick={() => {
              void navigate({ to: "/assinatura" });
            }}
            className="btn-gradient mt-6 w-full"
          >
            <Rocket className="mr-2 h-4 w-4" />
            Assinar por R$ 200/mês
          </Button>
        )}
        <Button
          onClick={handleSignOut}
          variant={isDemo ? "outline" : "destructive"}
          className="mt-3 w-full"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}