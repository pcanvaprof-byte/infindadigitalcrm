import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Circle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listBriefings } from "@/lib/briefings/api";
import { listOnboardings } from "@/modules/operacoes/fase2.api";
import { crmKeys } from "@/lib/crm/api";

type Step = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  active: boolean;
};

/**
 * Checklist global de Onboarding. Avança automaticamente conforme:
 *  - Briefings Comerciais criados / concluídos
 *  - Kickoffs de Produção criados / concluídos
 *  - Onboarding operacional concluído (op_onboarding.status = "concluido")
 */
export function OnboardingChecklist() {
  const bcQ = useQuery({
    queryKey: [...crmKeys.briefings, "briefing_comercial"],
    queryFn: () => listBriefings({ tipo: "briefing_comercial" }),
    staleTime: 10_000,
  });
  const kpQ = useQuery({
    queryKey: [...crmKeys.briefings, "kickoff_producao"],
    queryFn: () => listBriefings({ tipo: "kickoff_producao" }),
    staleTime: 10_000,
  });
  const onbQ = useQuery({ queryKey: ["op-onboarding"], queryFn: listOnboardings });

  const loading = bcQ.isLoading || kpQ.isLoading || onbQ.isLoading;

  const steps = useMemo<Step[]>(() => {
    const bc = bcQ.data ?? [];
    const kp = kpQ.data ?? [];
    const onb = onbQ.data ?? [];
    const bcCriado = bc.length > 0;
    const bcConcluido = bc.some((b) => b.status === "concluido");
    const kpCriado = kp.length > 0;
    const kpConcluido = kp.some((b) => b.status === "concluido");
    const onbConcluido = onb.some((o) => o.status === "concluido");

    const raw: Omit<Step, "active">[] = [
      { id: "bc_create",  title: "Criar Briefing Comercial",      description: "Disparado no momento do fechamento.",          done: bcCriado },
      { id: "bc_done",    title: "Briefing Comercial concluído",  description: "Cliente respondeu o briefing de pré-venda.",   done: bcConcluido },
      { id: "kp_create",  title: "Criar Kickoff de Produção",     description: "Coleta acessos e materiais.",                  done: kpCriado },
      { id: "kp_done",    title: "Kickoff concluído",             description: "Time recebeu tudo para iniciar a operação.",   done: kpConcluido },
      { id: "op_done",    title: "Onboarding operacional concluído", description: "Contas, integrações e metas validadas.",   done: onbConcluido },
    ];
    const firstPending = raw.findIndex((s) => !s.done);
    return raw.map((s, i) => ({ ...s, active: i === firstPending }));
  }, [bcQ.data, kpQ.data, onbQ.data]);

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  return (
    <Card className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Checklist de Onboarding</h3>
          <p className="text-xs text-muted-foreground">
            Avança automaticamente conforme briefings e onboarding são concluídos.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{done} de {steps.length}</div>
          <div className="mt-1 h-1.5 w-36 overflow-hidden rounded-full bg-background/60">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <ol className="grid gap-2">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={`flex items-start gap-3 rounded-md border px-3 py-2 transition ${
              s.done
                ? "border-emerald-500/30 bg-emerald-500/5"
                : s.active
                ? "border-primary/40 bg-primary/5"
                : "border-border/60 bg-background/30"
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                s.done
                  ? "bg-emerald-500 text-emerald-50"
                  : s.active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.done ? <Check className="h-3 w-3" /> : loading && s.active ? <Loader2 className="h-3 w-3 animate-spin" /> : <Circle className="h-3 w-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Passo {i + 1}
                </span>
                {s.active && !s.done && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                    Em andamento
                  </span>
                )}
              </div>
              <p className={`text-sm ${s.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {s.title}
              </p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}