import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, RefreshCw, Send, Settings2, SkipForward, Clock } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import {
  CAD_STAGE_LABEL,
  CAD_TEMP_LABEL,
  renderTemplate,
  sanitizeTemplateForSend,
  expandVariants,
  leadElegivelParaDisparo,
  type CadLead,
} from "@/lib/cadencia/types";
import { listLeads, resolveTemplate, registerSend, markProspectContactedFromLead } from "@/lib/cadencia/api";
import { chooseVariant } from "@/lib/prospeccao/variant-telemetry";
import { wasDispatchedToday, dispatchBlockedMessage } from "@/lib/dispatch-lock";
import {
  DEFAULT_AUTOWARM_CONFIG,
  FOLLOWUP_STAGES,
  countSendsToday,
  loadAutowarmConfig,
  planAutowarm,
  runAutowarmEngine,
  saveAutowarmConfig,
  type AutowarmConfig,
} from "@/lib/cadencia/autowarm";

export const Route = createFileRoute("/aquecimento")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Aquecimento Automático — INFINDA" },
      {
        name: "description",
        content:
          "Motor de aquecimento automático da base: fila diária por gatilhos de status e tempo, com disparo em sequência.",
      },
      { property: "og:title", content: "Aquecimento Automático — INFINDA" },
      {
        property: "og:description",
        content: "Régua automática de follow-ups com gatilhos de tempo e status para aquecer toda a base de leads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AquecimentoPage />
    </RequireAuth>
  ),
});

function onlyDigits(s: string) {
  return (s || "").replace(/\D+/g, "");
}
function waPhone(raw: string): string {
  const d = onlyDigits(raw);
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}
function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AquecimentoPage() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<AutowarmConfig>(DEFAULT_AUTOWARM_CONFIG);
  const [showCfg, setShowCfg] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setCfg(loadAutowarmConfig());
  }, []);

  function patchCfg(patch: Partial<AutowarmConfig>) {
    setCfg((prev) => {
      const next = { ...prev, ...patch };
      saveAutowarmConfig(next);
      return next;
    });
  }
  function patchInterval(stage: string, days: number) {
    setCfg((prev) => {
      const next = { ...prev, intervals: { ...prev.intervals, [stage]: days } };
      saveAutowarmConfig(next);
      return next;
    });
  }

  const leadsQ = useQuery({ queryKey: ["cad-leads"], queryFn: listLeads });
  const sentQ = useQuery({ queryKey: ["autowarm-sent-today"], queryFn: countSendsToday });

  const plan = useMemo(
    () => planAutowarm(leadsQ.data ?? [], cfg, new Date(), sentQ.data ?? 0),
    [leadsQ.data, cfg, sentQ.data],
  );

  const current: CadLead | null = plan.fila[cursor] ?? null;

  const tplQ = useQuery({
    queryKey: ["cad-resolved-template", current?.stage ?? null],
    queryFn: () => resolveTemplate(current!.stage),
    enabled: !!current,
  });

  useEffect(() => {
    if (!current) {
      setMsg("");
      return;
    }
    const corpo = tplQ.data?.corpo ?? "";
    if (!corpo) {
      setMsg("");
      return;
    }
    const pick = chooseVariant(corpo, {
      scope: "cadencia",
      bucketKey: `cad:${current.stage}`,
      stage: current.stage,
      leadId: current.id,
      company: current.empresa ?? null,
    });
    setMsg(renderTemplate(pick.text, current));
  }, [current, tplQ.data]);

  const runMut = useMutation({
    mutationFn: () => runAutowarmEngine(cfg),
    onSuccess: (r) => {
      toast.success(
        `Motor executado: ${r.agendados} agendados, ${r.aquecidos} aquecidos, ${r.esfriados} esfriados, ${r.encerrados} encerrados${r.importados ? `, ${r.importados} importados` : ""}.`,
      );
      qc.invalidateQueries({ queryKey: ["cad-leads"] });
      qc.invalidateQueries({ queryKey: ["cad-metrics"] });
      setCursor(0);
    },
    onError: (e) => toast.error(`Falha no motor: ${(e as Error).message}`),
  });

  async function enviarEAvancar() {
    if (!current || sending) return;
    const sendMsg = sanitizeTemplateForSend(msg);
    if (!sendMsg) {
      toast.warning("Mensagem vazia — configure o template do estágio.");
      return;
    }
    const elig = leadElegivelParaDisparo(current);
    if (!elig.elegivel) {
      toast.error(elig.motivo || "Lead não elegível.");
      return;
    }
    const phone = waPhone(current.whatsapp || current.telefone || "");
    if (!phone) {
      toast.warning("Lead sem WhatsApp.");
      setCursor((c) => c + 1);
      return;
    }
    setSending(true);
    const lock = await wasDispatchedToday({ leadId: current.id, prospectId: current.prospect_id ?? null });
    if (lock.blocked) {
      toast.error(dispatchBlockedMessage(lock.source!));
      setSending(false);
      setCursor((c) => c + 1);
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(sendMsg)}`;
    const mobile = isMobile();
    if (!mobile) window.open(url, "_blank", "noopener,noreferrer");
    try {
      await registerSend({ leadId: current.id, tipo: "whatsapp", mensagem: sendMsg, advance: true });
      try {
        await markProspectContactedFromLead(current.id);
      } catch {
        /* sync best-effort */
      }
      toast.success("Disparo registrado — próximo lead carregado.");
      qc.invalidateQueries({ queryKey: ["cad-leads"] });
      qc.invalidateQueries({ queryKey: ["autowarm-sent-today"] });
      setCursor((c) => c + 1);
    } catch (e) {
      toast.error(`Falha ao registrar: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
    if (mobile) window.location.href = url;
  }

  const restante = Math.max(0, cfg.dailyCap - (sentQ.data ?? 0));

  return (
    <AppShell
      title="Aquecimento Automático"
      subtitle="Régua automática por gatilhos de status e tempo: o motor mantém toda a base agendada e entrega a fila do dia pronta para disparo."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowCfg((v) => !v)}>
            <Settings2 className="mr-2 h-4 w-4" /> Regras
          </Button>
          <Button variant="outline" onClick={() => runMut.mutate()} disabled={runMut.isPending}>
            {runMut.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Rodar motor agora
          </Button>
        </div>
      }
    >
      <div className="space-y-6">

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Base na régua" value={plan.total} />
          <Metric label="Fila de hoje" value={plan.fila.length} hint={`teto ${cfg.dailyCap}/dia`} />
          <Metric label="Vencidos" value={plan.vencidos} hint="gatilho de tempo" />
          <Metric label="Agendados" value={plan.agendados} hint="aguardando data" />
          <Metric label="Enviados hoje" value={sentQ.data ?? 0} hint={`restam ${restante}`} />
          <Metric label="Sem WhatsApp" value={plan.semTelefone} hint="enriquecer no mapa" />
        </section>

        {!plan.dentroDaJanela && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Fora da janela de disparo ({cfg.workStartHour}h–{cfg.workEndHour}h
            {cfg.weekdaysOnly ? ", dias úteis" : ""}). O motor continua agendando, mas evite disparar agora.
          </div>
        )}

        {showCfg && (
          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Gatilhos e limites</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Teto diário</Label>
                <Input
                  type="number"
                  min={1}
                  value={cfg.dailyCap}
                  onChange={(e) => patchCfg({ dailyCap: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Leads por rodada</Label>
                <Input
                  type="number"
                  min={1}
                  value={cfg.batchSize}
                  onChange={(e) => patchCfg({ batchSize: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Intervalo entre rodadas (s)</Label>
                <Input
                  type="number"
                  min={10}
                  value={cfg.batchIntervalSec}
                  onChange={(e) => patchCfg({ batchIntervalSec: Number(e.target.value) || 10 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Janela — início (h)</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={cfg.workStartHour}
                  onChange={(e) => patchCfg({ workStartHour: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Janela — fim (h)</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={cfg.workEndHour}
                  onChange={(e) => patchCfg({ workEndHour: Number(e.target.value) || 24 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dias sem resposta → frio</Label>
                <Input
                  type="number"
                  min={1}
                  value={cfg.coolDays}
                  onChange={(e) => patchCfg({ coolDays: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Dias após o último follow-up → perdido</Label>
                <Input
                  type="number"
                  min={1}
                  value={cfg.dropAfterLastDays}
                  onChange={(e) => patchCfg({ dropAfterLastDays: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <Label className="text-xs">Só dias úteis</Label>
                <Switch checked={cfg.weekdaysOnly} onCheckedChange={(v) => patchCfg({ weekdaysOnly: v })} />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <Label className="text-xs">Importar prospectados</Label>
                <Switch checked={cfg.autoImport} onCheckedChange={(v) => patchCfg({ autoImport: v })} />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <Label className="text-xs">Motor ligado</Label>
                <Switch checked={cfg.enabled} onCheckedChange={(v) => patchCfg({ enabled: v })} />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Intervalo entre follow-ups (dias)
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {FOLLOWUP_STAGES.map((stage) => (
                  <div key={stage} className="space-y-1">
                    <Label className="text-[11px] whitespace-nowrap">{CAD_STAGE_LABEL[stage]}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={cfg.intervals[stage] ?? 3}
                      onChange={(e) => patchInterval(stage, Number(e.target.value) || 1)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Piloto de aquecimento</h2>
              <Badge variant="secondary">
                {plan.fila.length === 0 ? "fila vazia" : `${Math.min(cursor + 1, plan.fila.length)} de ${plan.fila.length}`}
              </Badge>
            </div>
            {!current ? (
              <p className="text-sm text-muted-foreground">
                {leadsQ.isLoading
                  ? "Carregando base…"
                  : plan.total === 0
                    ? "Nenhum lead na régua ainda. Rode o motor para importar os prospectados."
                    : "Nenhum lead vencido dentro do teto de hoje. O motor reagenda automaticamente."}
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="truncate text-base font-medium">{current.empresa}</p>
                  <p className="text-xs text-muted-foreground">
                    {current.responsavel || "sem contato"} · {CAD_STAGE_LABEL[current.stage]} ·{" "}
                    {CAD_TEMP_LABEL[current.temperatura]}
                  </p>
                </div>
                <Textarea rows={8} value={msg} onChange={(e) => setMsg(e.target.value)} />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={enviarEAvancar} disabled={sending || !msg.trim()} className="sm:flex-1">
                    <Send className="mr-2 h-4 w-4" /> Enviar e avançar
                  </Button>
                  <Button variant="outline" onClick={() => setCursor((c) => c + 1)} disabled={sending}>
                    <SkipForward className="mr-2 h-4 w-4" /> Pular
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Fila do dia</h2>
            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {plan.fila.slice(0, 50).map((lead, idx) => (
                <li
                  key={lead.id}
                  className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs ${
                    idx === cursor ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setCursor(idx)}>
                    <span className="block truncate font-medium">{lead.empresa}</span>
                    <span className="block truncate text-muted-foreground">
                      {CAD_STAGE_LABEL[lead.stage]} ·{" "}
                      {lead.next_action_at
                        ? new Date(lead.next_action_at).toLocaleDateString("pt-BR")
                        : "sem agenda"}
                    </span>
                  </button>
                  <Badge variant="outline" className="whitespace-nowrap">{CAD_TEMP_LABEL[lead.temperatura]}</Badge>
                </li>
              ))}
              {plan.fila.length === 0 && <li className="text-xs text-muted-foreground">Sem leads vencidos hoje.</li>}
            </ul>
          </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
