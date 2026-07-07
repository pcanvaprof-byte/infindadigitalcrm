import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, Save as SaveIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  NICHE_KEYS,
  NICHE_LABELS,
  type NicheKey,
} from "@/lib/prospeccao/niche-templates";
import {
  listNichePackEditedKeys,
  listNichePackStages,
  nichePackKeys,
  resetNichePackStage,
  upsertNichePackStage,
  type NichePackStage,
} from "@/lib/cadencia/niche-pack-api";
import { CAD_STAGE_LABEL, renderTemplate, sanitizeTemplateForSend, type CadStage } from "@/lib/cadencia/types";

const PREVIEW_LEAD = { empresa: "Padaria Modelo", responsavel: "Maria Silva" };
const FOLLOWUP_STAGES: CadStage[] = [
  "followup_1",
  "followup_2",
  "followup_3",
  "followup_4",
  "followup_5",
  "followup_6",
  "followup_7",
];

function stageLabel(stage: CadStage): string {
  if (stage === "followup_1") return "Abertura (Follow-up 1)";
  if (stage === "followup_7") return "Encerramento (Follow-up 7)";
  return CAD_STAGE_LABEL[stage];
}

export function NichePackEditor() {
  const qc = useQueryClient();
  const [selectedNiche, setSelectedNiche] = useState<NicheKey>(NICHE_KEYS[0]);
  const [selectedStage, setSelectedStage] = useState<CadStage>("followup_1");
  const [resetOpen, setResetOpen] = useState(false);

  const editedQ = useQuery({
    queryKey: nichePackKeys.edited(),
    queryFn: listNichePackEditedKeys,
    staleTime: 30_000,
  });

  const stagesQ = useQuery({
    queryKey: nichePackKeys.stages(selectedNiche),
    queryFn: () => listNichePackStages(selectedNiche),
    staleTime: 30_000,
  });

  const [draft, setDraft] = useState<{ titulo: string; corpo: string }>({ titulo: "", corpo: "" });
  const [dirty, setDirty] = useState(false);

  const current: NichePackStage | undefined = useMemo(
    () => stagesQ.data?.find((s) => s.stage === selectedStage),
    [stagesQ.data, selectedStage],
  );

  // Reseta o draft ao trocar de nicho/etapa ou quando o remoto muda.
  const bodyKey = `${selectedNiche}:${selectedStage}:${current?.is_override ? "own" : "def"}`;
  const [bodyKeySeen, setBodyKeySeen] = useState<string>("");
  useEffect(() => {
    if (!current || bodyKey === bodyKeySeen) return;
    setDraft({ titulo: current.titulo, corpo: current.corpo });
    setDirty(false);
    setBodyKeySeen(bodyKey);
  }, [bodyKey, bodyKeySeen, current]);

  const preview = useMemo(
    () => sanitizeTemplateForSend(renderTemplate(draft.corpo || current?.corpo || "", PREVIEW_LEAD)),
    [draft.corpo, current?.corpo],
  );

  const saveMut = useMutation({
    mutationFn: () =>
      upsertNichePackStage({
        nicheKey: selectedNiche,
        stage: selectedStage,
        titulo: draft.titulo.trim() || `Mensagem — ${selectedStage}`,
        corpo: draft.corpo,
      }),
    onSuccess: () => {
      toast.success(`${NICHE_LABELS[selectedNiche]} · ${stageLabel(selectedStage)} salvo.`);
      setDirty(false);
      qc.invalidateQueries({ queryKey: nichePackKeys.all });
    },
    onError: (e) => toast.error(`Falha ao salvar: ${(e as Error).message}`),
  });

  const resetStageMut = useMutation({
    mutationFn: () => resetNichePackStage(selectedNiche, selectedStage),
    onSuccess: () => {
      toast.success("Etapa restaurada ao padrão do sistema.");
      qc.invalidateQueries({ queryKey: nichePackKeys.all });
    },
    onError: (e) => toast.error(`Falha ao restaurar: ${(e as Error).message}`),
  });

  const resetPackMut = useMutation({
    mutationFn: () => resetNichePackStage(selectedNiche, null),
    onSuccess: (n) => {
      toast.success(`${n} etapa(s) restaurada(s) ao padrão.`);
      setResetOpen(false);
      qc.invalidateQueries({ queryKey: nichePackKeys.all });
    },
    onError: (e) => toast.error(`Falha ao restaurar: ${(e as Error).message}`),
  });

  const editedMap = editedQ.data ?? new Map<string, number>();
  const editedForSelected = editedMap.get(selectedNiche) ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Sidebar: nichos */}
      <aside className="rounded-lg border border-border bg-card p-2">
        <div className="mb-2 px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Nichos ({NICHE_KEYS.length})
        </div>
        <ul className="flex flex-col gap-0.5">
          {NICHE_KEYS.map((key) => {
            const editedCount = editedMap.get(key) ?? 0;
            const active = key === selectedNiche;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setSelectedNiche(key)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span className="truncate">{NICHE_LABELS[key]}</span>
                  {editedCount > 0 && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {editedCount} editada{editedCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Editor da etapa selecionada */}
      <section className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">
                {NICHE_LABELS[selectedNiche]}
              </h2>
              <p className="text-xs text-muted-foreground">
                Pack de cadência do nicho — {editedForSelected > 0
                  ? `${editedForSelected} etapa(s) personalizada(s)`
                  : "usando padrão do sistema"}
                .
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedStage} onValueChange={(v) => setSelectedStage(v as CadStage)}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWUP_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {stageLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetStageMut.mutate()}
                disabled={!current?.is_override || resetStageMut.isPending}
                title={current?.is_override ? "Voltar esta etapa ao padrão do sistema" : "Esta etapa já está no padrão"}
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Restaurar etapa
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetOpen(true)}
                disabled={editedForSelected === 0}
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Restaurar pack inteiro
              </Button>
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={!dirty || saveMut.isPending}
              >
                <SaveIcon className="mr-1 h-4 w-4" />
                Salvar
              </Button>
            </div>
          </div>

          {stagesQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Título interno
                </span>
                {current?.is_override ? (
                  <Badge variant="secondary" className="text-[10px]">personalizado</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">padrão do sistema</Badge>
                )}
              </div>
              <Input
                value={draft.titulo}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, titulo: e.target.value }));
                  setDirty(true);
                }}
                placeholder={`Mensagem — ${selectedStage}`}
              />
              <span className="mt-2 block text-[11px] uppercase tracking-wide text-muted-foreground">
                Corpo da mensagem
              </span>
              <Textarea
                rows={12}
                className="font-mono text-sm"
                value={draft.corpo}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, corpo: e.target.value }));
                  setDirty(true);
                }}
                placeholder={"Versão A da mensagem\n---\nVersão B (rotação anti-bloqueio)"}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">
                Variáveis: <code>{"{{primeiro_nome}}"}</code>, <code>{"{{empresa}}"}</code>,{" "}
                <code>{"{{empresa_curta}}"}</code>, <code>{"{{responsavel}}"}</code>. Separe variantes
                com uma linha contendo apenas <code>---</code> para rotação anti-bloqueio no WhatsApp.
              </p>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Pré-visualização (Maria Silva / Padaria Modelo)
          </div>
          <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
            {preview || "—"}
          </pre>
        </Card>
      </section>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar pack de {NICHE_LABELS[selectedNiche]}?</DialogTitle>
            <DialogDescription>
              Todas as etapas personalizadas deste nicho serão removidas e voltarão ao padrão do
              sistema. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => resetPackMut.mutate()}
              disabled={resetPackMut.isPending}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Restaurar tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}