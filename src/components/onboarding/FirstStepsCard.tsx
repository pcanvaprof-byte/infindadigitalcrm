import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle, Send, Sparkles, Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboardingState, openWelcomeTour } from "@/hooks/useOnboarding";

export function FirstStepsCard() {
  const { data: state, isLoading } = useOnboardingState();
  const navigate = useNavigate();

  if (isLoading || !state || state.completed) return null;

  const items = [
    {
      key: "business",
      icon: Sparkles,
      label: "Meu Negócio configurado",
      done: state.steps.business,
      to: "/meu-negocio",
    },
    {
      key: "dispatch",
      icon: Send,
      label: "Primeiro disparo feito",
      done: state.steps.dispatch,
      to: "/prospeccao",
    },
  ] as const;

  const next = items.find((i) => !i.done);
  const pct = Math.round((state.done / state.total) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">Primeiros passos</h3>
            <span className="text-xs font-semibold text-muted-foreground">
              {state.done} de {state.total}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key} className="flex items-center gap-2 text-xs">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={item.done ? "text-muted-foreground line-through" : "text-foreground"}>
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
          {next && (
            <Button className="btn-gradient" onClick={() => void navigate({ to: next.to })}>
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={openWelcomeTour}>
            <Compass className="mr-2 h-4 w-4" />
            Ver o guia
          </Button>
        </div>
      </div>
    </div>
  );
}
