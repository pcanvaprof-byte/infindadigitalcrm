import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Circle,
  KeyRound,
  Sparkles,
  Send,
  PartyPopper,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth-context";
import { useOrgRole } from "@/lib/org/plans";
import {
  useMarkOnboardingSeen,
  useOnboardingState,
  localSeenKey,
  OPEN_TOUR_EVENT,
} from "@/hooks/useOnboarding";
import { tourStepsForRole } from "./tour-steps";

type Phase = "checklist" | "tour" | "done";

export function WelcomeOnboardingDialog() {
  const { user } = useAuth();
  const { role } = useOrgRole();
  const navigate = useNavigate();
  const { data: state } = useOnboardingState();
  const markSeen = useMarkOnboardingSeen();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("checklist");
  const [slide, setSlide] = useState(0);

  const steps = useMemo(() => tourStepsForRole(role), [role]);

  // Abertura automática na primeira sessão.
  useEffect(() => {
    if (!state || !user?.id) return;
    if (state.seen) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(localSeenKey(user.id)) === "1") {
      return;
    }
    setPhase("checklist");
    setSlide(0);
    setOpen(true);
  }, [state, user?.id]);

  // Reabertura manual ("Ver tour novamente").
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setPhase("tour");
      setSlide(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR_EVENT, handler);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, handler);
  }, []);

  if (!state) return null;

  const firstName = (user?.name ?? "").split(" ")[0] || "bem-vindo(a)";

  const checklist = [
    {
      key: "business",
      icon: Sparkles,
      title: "Configurar Meu Negócio",
      desc: "Nicho, público e tom de voz — é daqui que sai a primeira mensagem da IA.",
      done: state.steps.business,
      cta: "Configurar agora",
      to: "/meu-negocio",
    },
    {
      key: "dispatch",
      icon: Send,
      title: "Fazer o primeiro disparo",
      desc: "Escolha um lead em Prospecção e envie o primeiro contato pelo WhatsApp.",
      done: state.steps.dispatch,
      cta: "Ir para Prospecção",
      to: "/prospeccao",
    },
  ] as const;

  const pct = Math.round((state.done / state.total) * 100);

  const close = () => {
    setOpen(false);
    markSeen.mutate();
  };

  const goTo = (to: string) => {
    close();
    void navigate({ to });
  };

  const current = steps[slide];
  const Icon = current?.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
        else setOpen(true);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {phase === "checklist" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <PartyPopper className="h-5 w-5 text-primary" />
                Olá, {firstName}! Bem-vinda à INFINDA
              </DialogTitle>
              <DialogDescription>
                São 3 passos rápidos para deixar sua operação pronta. Você pode fechar e
                continuar depois — o progresso fica salvo.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Primeiros passos</span>
                <span className="font-semibold text-foreground">
                  {state.done} de {state.total}
                </span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>

            <ul className="mt-2 space-y-2">
              {checklist.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <li
                    key={item.key}
                    className={`flex items-start gap-3 rounded-xl border p-3 ${
                      item.done
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="mt-0.5">
                      {item.done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <ItemIcon className="h-4 w-4 text-muted-foreground" />
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    {!item.done && (
                      <Button size="sm" variant="secondary" onClick={() => goTo(item.to)}>
                        {item.cta}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={close}>
                Explorar sozinha
              </Button>
              <Button className="btn-gradient" onClick={() => setPhase("tour")}>
                Ver o guia das abas
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "tour" && current && Icon && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                {current.label}
              </DialogTitle>
              <DialogDescription>{current.what}</DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Quando usar: </span>
              {current.when}
            </div>

            <div className="flex items-center justify-center gap-1.5 pt-1">
              {steps.map((s, i) => (
                <button
                  key={s.to}
                  type="button"
                  aria-label={`Ir para ${s.label}`}
                  onClick={() => setSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === slide ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => (slide === 0 ? setPhase("checklist") : setSlide((s) => s - 1))}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              {slide < steps.length - 1 ? (
                <Button className="btn-gradient" onClick={() => setSlide((s) => s + 1)}>
                  Próxima
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button className="btn-gradient" onClick={() => setPhase("done")}>
                  Concluir
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {phase === "done" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <PartyPopper className="h-5 w-5 text-primary" />
                Tudo pronto para começar
              </DialogTitle>
              <DialogDescription>
                O card "Primeiros passos" fica no Dashboard até você concluir o checklist. Para
                rever este guia, use "Ver tour novamente" na Documentação.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={close}>
                Fechar
              </Button>
              <Button className="btn-gradient" onClick={() => goTo("/meu-negocio")}>
                Configurar Meu Negócio
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
