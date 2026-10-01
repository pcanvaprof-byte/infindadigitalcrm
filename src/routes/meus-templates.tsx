import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquareText, Pencil, RotateCcw, Save, X } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import { CAD_STAGE_LABEL, type CadStage, renderTemplate } from "@/lib/cadencia/types";
import {
  listMyTemplates,
  upsertMyTemplate,
  resetMyTemplate,
  type MyTemplateRow,
} from "@/lib/cadencia/api";

// Ordem exibida — apenas os 7 follow-ups (motor de disparo).
// Demais estágios continuam disponíveis no editor da organização.
const DISPLAY_STAGES: CadStage[] = [
  "followup_1", "followup_2", "followup_3", "followup_4",
  "followup_5", "followup_6", "followup_7",
];

export const Route = createFileRoute("/meus-templates")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Meus Templates — INFINDA" },
      { name: "description", content: "Personalize seus próprios textos de cadência sem afetar os demais membros." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <MyTemplatesPage />
    </RequireAuth>
  ),
});

// Preview usa exatamente o mesmo parser do motor de disparo.
const PREVIEW_LEAD = { empresa: "Empresa Exemplo", responsavel: "João Silva" };

function MyTemplatesPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-templates"], queryFn: listMyTemplates });

  const byStage = useMemo(() => {
    const m = new Map<CadStage, MyTemplateRow>();
    for (const r of q.data ?? []) m.set(r.stage, r);
    return m;
  }, [q.data]);

  const [editing, setEditing] = useState<CadStage | null>(null);
  const [draft, setDraft] = useState<{ titulo: string; corpo: string }>({ titulo: "", corpo: "" });

  const upsertM = useMutation({
    mutationFn: (input: { stage: CadStage; titulo: string; corpo: string }) => upsertMyTemplate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-templates"] });
      qc.invalidateQueries({ queryKey: ["cad-resolved-templates"] });
      qc.invalidateQueries({ queryKey: ["cad-resolved-template"] });
      toast.success("Template salvo");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetM = useMutation({
    mutationFn: (stage: CadStage) => resetMyTemplate(stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-templates"] });
      qc.invalidateQueries({ queryKey: ["cad-resolved-templates"] });
      qc.invalidateQueries({ queryKey: ["cad-resolved-template"] });
      toast.success("Padrão da organização restaurado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEdit(stage: CadStage) {
    const row = byStage.get(stage);
    setDraft({ titulo: row?.titulo ?? "", corpo: row?.corpo ?? "" });
    setEditing(stage);
  }

  return (
    <AppShell title="Meus Templates">
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <header className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MessageSquareText className="h-6 w-6 text-primary" />
            Meus Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Personalize sua cadência sem afetar os demais membros. Enquanto você não personaliza,
            o texto usado no envio é o <strong>padrão da organização</strong>.
          </p>
        </header>

        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Variáveis disponíveis: <code>{"{{nome}}"}</code>, <code>{"{{responsavel}}"}</code>,{" "}
          <code>{"{{empresa}}"}</code>, <code>{"{{empresa_curta}}"}</code>. O motor de disparo usa
          exatamente essa resolução — o que você vê no preview é o que será enviado.
        </div>

        {q.isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {q.error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Erro ao carregar: {(q.error as Error).message}
          </div>
        )}

        <div className="space-y-3">
          {DISPLAY_STAGES.map((stage) => {
            const row = byStage.get(stage);
            const isMine = row?.source === "user";
            const isEditing = editing === stage;

            return (
              <section
                key={stage}
                className="rounded-lg border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{CAD_STAGE_LABEL[stage]}</span>
                    {isMine ? (
                      <Badge variant="default">Meu Template</Badge>
                    ) : (
                      <Badge variant="secondary">Padrão da Organização</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isEditing && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(stage)}>
                        <Pencil className="mr-1.5 h-4 w-4" />
                        {isMine ? "Editar" : "Personalizar"}
                      </Button>
                    )}
                    {isMine && !isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Restaurar padrão da organização? Seu texto atual será apagado.")) {
                            resetM.mutate(stage);
                          }
                        }}
                      >
                        <RotateCcw className="mr-1.5 h-4 w-4" />
                        Restaurar padrão
                      </Button>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Título</div>
                    <div className="text-sm">{row?.titulo ?? "—"}</div>
                    <div className="mt-2 text-xs font-medium text-muted-foreground">Mensagem</div>
                    <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
                      {row?.corpo ?? "—"}
                    </pre>
                    <div className="mt-2 text-xs font-medium text-muted-foreground">
                      Preview (com variáveis renderizadas)
                    </div>
                    <pre className="whitespace-pre-wrap rounded-md border border-dashed border-border bg-background p-3 text-sm text-foreground">
                      {renderTemplate(row?.corpo ?? "", PREVIEW_LEAD)}
                    </pre>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1.5">
                      <Label>Título</Label>
                      <Input
                        value={draft.titulo}
                        onChange={(e) => setDraft((d) => ({ ...d, titulo: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Mensagem</Label>
                      <Textarea
                        rows={8}
                        value={draft.corpo}
                        onChange={(e) => setDraft((d) => ({ ...d, corpo: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Preview</Label>
                      <pre className="whitespace-pre-wrap rounded-md border border-dashed border-border bg-background p-3 text-sm">
                        {renderTemplate(draft.corpo, PREVIEW_LEAD)}
                      </pre>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          upsertM.mutate({ stage, titulo: draft.titulo.trim(), corpo: draft.corpo })
                        }
                        disabled={upsertM.isPending || !draft.titulo.trim() || !draft.corpo.trim()}
                      >
                        <Save className="mr-1.5 h-4 w-4" />
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <X className="mr-1.5 h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}