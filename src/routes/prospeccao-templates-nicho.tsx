import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  History as HistoryIcon,
  RotateCcw,
  Save as SaveIcon,
  Undo2,
} from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  NICHE_TEMPLATES,
  type NicheKey,
} from "@/lib/prospeccao/niche-templates";
import {
  listCurrentNicheTemplates,
  listNicheTemplateVersions,
  nicheTemplateKeys,
  resetNicheTemplate,
  restoreNicheTemplateVersion,
  saveNicheTemplate,
  type NicheTemplateRow,
} from "@/lib/prospeccao/niche-templates-api";
import { renderTemplate, sanitizeTemplateForSend } from "@/lib/cadencia/types";

export const Route = createFileRoute("/prospeccao-templates-nicho")({
  head: () => ({
    meta: [
      { title: "Templates por Nicho — INFINDA" },
      {
        name: "description",
        content: "Edite e versione as mensagens de prospecção por nicho.",
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <AppShell title="Templates por Nicho">
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        Erro: {error instanceof Error ? error.message : String(error)}
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell title="Templates por Nicho">
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        Página não encontrada.
      </div>
    </AppShell>
  ),
  component: () => (
    <RequireAuth>
      <TemplatesNichoPage />
    </RequireAuth>
  ),
});

const PREVIEW_LEAD = { empresa: "Padaria Modelo", responsavel: "Maria Silva" };

function TemplatesNichoPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<NicheKey>(NICHE_KEYS[0]);
  const [draft, setDraft] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);

  const { data: currentRows = [], isLoading } = useQuery({
    queryKey: nicheTemplateKeys.current(),
    queryFn: listCurrentNicheTemplates,
    staleTime: 60_000,
  });

  const currentByKey = useMemo(() => {
    const m = new Map<NicheKey, NicheTemplateRow>();
    for (const r of currentRows) m.set(r.niche_key as NicheKey, r);
    return m;
  }, [currentRows]);

  const currentBody = currentByKey.get(selected)?.corpo ?? NICHE_TEMPLATES[selected];
  const isCustom = currentByKey.has(selected);

  // Reset do draft ao trocar de nicho ou quando o dado remoto muda.
  const bodyKey = `${selected}:${currentByKey.get(selected)?.id ?? "default"}`;
  const [bodyKeySeen, setBodyKeySeen] = useState(bodyKey);
  if (bodyKey !== bodyKeySeen) {
    setBodyKeySeen(bodyKey);
    setDraft(currentBody);
    setDirty(false);
  }

  const preview = useMemo(
    () => sanitizeTemplateForSend(renderTemplate(draft || currentBody, PREVIEW_LEAD)),
    [draft, currentBody],
  );

  const saveMut = useMutation({
    mutationFn: (corpo: string) => saveNicheTemplate(selected, corpo),
    onSuccess: () => {
      toast.success(`Template "${NICHE_LABELS[selected]}" salvo.`);
      setDirty(false);
      qc.invalidateQueries({ queryKey: nicheTemplateKeys.all });
    },
    onError: (e) => toast.error(`Falha ao salvar: ${(e as Error).message}`),
  });

  const resetMut = useMutation({
    mutationFn: () => resetNicheTemplate(selected),
    onSuccess: () => {
      toast.success(`"${NICHE_LABELS[selected]}" voltou ao padrão do sistema.`);
      setResetConfirm(false);
      qc.invalidateQueries({ queryKey: nicheTemplateKeys.all });
    },
    onError: (e) => toast.error(`Falha ao restaurar padrão: ${(e as Error).message}`),
  });

  const restoreVersionMut = useMutation({
    mutationFn: (versionId: string) => restoreNicheTemplateVersion(versionId),
    onSuccess: () => {
      toast.success("Versão reativada como corrente.");
      setHistoryOpen(false);
      qc.invalidateQueries({ queryKey: nicheTemplateKeys.all });
    },
    onError: (e) => toast.error(`Falha ao reativar: ${(e as Error).message}`),
  });

  return (
    <AppShell title="Templates por Nicho" subtitle="Edite as mensagens de fallback usadas na prospecção">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/prospeccao">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar para Prospecção
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Lista de nichos */}
        <aside className="surface-card p-2">
          <div className="mb-2 px-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Nichos ({NICHE_KEYS.length})
          </div>
          <ul className="flex flex-col gap-0.5">
            {NICHE_KEYS.map((key) => {
              const custom = currentByKey.has(key);
              const active = key === selected;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setSelected(key)}
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                      active ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    <span className="truncate">{NICHE_LABELS[key]}</span>
                    {custom && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        editado
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Editor */}
        <section className="flex flex-col gap-4">
          <div className="surface-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">{NICHE_LABELS[selected]}</h2>
                <p className="text-xs text-muted-foreground">
                  {isCustom
                    ? `Versão corrente v${currentByKey.get(selected)?.version} (personalizada).`
                    : "Usando texto padrão do sistema."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                  disabled={isLoading}
                >
                  <HistoryIcon className="mr-1 h-4 w-4" />
                  Histórico
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetConfirm(true)}
                  disabled={!isCustom || resetMut.isPending}
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Restaurar padrão
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveMut.mutate(draft)}
                  disabled={!dirty || !draft.trim() || saveMut.isPending}
                >
                  <SaveIcon className="mr-1 h-4 w-4" />
                  Salvar nova versão
                </Button>
              </div>
            </div>

            <Textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setDirty(e.target.value !== currentBody);
              }}
              rows={14}
              className="font-mono text-sm"
              placeholder="Digite a mensagem com {{primeiro_nome}} etc."
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Variáveis: <code>{"{{primeiro_nome}}"}</code>, <code>{"{{empresa}}"}</code>,{" "}
                <code>{"{{responsavel}}"}</code>
              </span>
              <span>{draft.length} caracteres</span>
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Pré-visualização (Maria Silva / Padaria Modelo)
            </div>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
              {preview || "—"}
            </pre>
          </div>
        </section>
      </div>

      {/* Dialog: histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {NICHE_LABELS[selected]}</DialogTitle>
            <DialogDescription>
              Toda edição gera uma nova versão. Você pode reativar qualquer versão anterior.
            </DialogDescription>
          </DialogHeader>
          <VersionsList
            nicheKey={selected}
            onRestore={(id) => restoreVersionMut.mutate(id)}
            restoring={restoreVersionMut.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar reset */}
      <Dialog open={resetConfirm} onOpenChange={setResetConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar template padrão?</DialogTitle>
            <DialogDescription>
              Todas as versões personalizadas de "{NICHE_LABELS[selected]}" serão removidas
              e o sistema voltará a usar o texto embutido no código. Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => resetMut.mutate()}
              disabled={resetMut.isPending}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Restaurar padrão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function VersionsList({
  nicheKey,
  onRestore,
  restoring,
}: {
  nicheKey: NicheKey;
  onRestore: (versionId: string) => void;
  restoring: boolean;
}) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: nicheTemplateKeys.versions(nicheKey),
    queryFn: () => listNicheTemplateVersions(nicheKey),
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando histórico…</div>;
  }
  if (!rows.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Sem versões personalizadas. O sistema está usando o template padrão.
      </div>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-md border border-border p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">v{r.version}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.updated_at).toLocaleString("pt-BR")}
                </span>
                {r.is_current && (
                  <Badge variant="secondary" className="text-[10px]">
                    corrente
                  </Badge>
                )}
              </div>
              {!r.is_current && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRestore(r.id)}
                  disabled={restoring}
                >
                  <Undo2 className="mr-1 h-4 w-4" />
                  Reativar
                </Button>
              )}
            </div>
            <pre className="whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
              {r.corpo}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
