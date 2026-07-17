import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";

export function BusinessSetupCard() {
  const { data, isLoading } = useBusinessProfile();
  if (isLoading) return null;
  if (data && data.onboarding_status === "completed") return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary/15 p-3 text-primary">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Configure seu Negócio</h3>
            <p className="max-w-xl text-sm text-muted-foreground">
              Vamos entender sua empresa para que a IA personalize toda a prospecção
              automaticamente — nicho, público, tom de voz e a primeira mensagem de contato.
            </p>
          </div>
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link to="/meu-negocio">
            Configurar Negócio
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}