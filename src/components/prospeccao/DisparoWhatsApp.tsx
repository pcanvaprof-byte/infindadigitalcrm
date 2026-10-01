import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  X,
  Pause,
  Play,
} from "lucide-react";
import type { Prospect } from "@/lib/mock-prospects";
import { updateProspect } from "@/lib/prospects-api";
import { pickNicheMessage } from "@/lib/prospeccao/niche-templates";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisparoWhatsAppProps {
  prospects: Prospect[];
}

type ItemStatus = "pending" | "sending" | "sent" | "failed";

interface QueueItem {
  id: string;
  phone: string;
  company: string;
  message: string;
  status: ItemStatus;
  reason?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  // Garante DDI 55 para BR
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

function isPhoneValid(raw: string): boolean {
  return (raw || "").replace(/\D/g, "").length >= 10;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// ─── Chave de comunicação Tampermonkey → CRM ──────────────────────────────────
// O script Tampermonkey escreve nesta chave ao enviar/falhar.
// O CRM lê a chave para saber o resultado e avança para o próximo.
const TM_RESULT_KEY = "infinda_disparo_result";
const TM_PENDING_KEY = "infinda_disparo_pending";

// ─── Component ───────────────────────────────────────────────────────────────

export function DisparoWhatsApp({ prospects }: DisparoWhatsAppProps) {
  // ── Seleção ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [delayMin, setDelayMin] = useState(80);
  const [delayMax, setDelayMax] = useState(100);

  // ── Fila ─────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);

  // ── Prospects elegíveis ───────────────────────────────────────────────────
  const eligible = prospects.filter(
    (p) => p.status === "nao_contatado" && isPhoneValid(p.whatsapp || ""),
  );

  const allSelected = eligible.length > 0 && eligible.every((p) => selectedIds.has(p.id));
  const someSelected = eligible.some((p) => selectedIds.has(p.id));

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(eligible.map((p) => p.id)));
  }, [allSelected, eligible]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Disparo via WhatsApp Web + Tampermonkey ───────────────────────────────
  const updateItem = useCallback((idx: number, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }, []);

  const waitForTampermonkey = useCallback((
    prospectId: string,
    timeoutMs: number,
  ): Promise<{ success: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const start = Date.now();
      // Limpa resultado anterior
      try { localStorage.removeItem(TM_RESULT_KEY); } catch {}
      // Escreve o ID pendente para o TM saber qual prospect está sendo disparado
      try { localStorage.setItem(TM_PENDING_KEY, prospectId); } catch {}

      const poll = setInterval(() => {
        try {
          const raw = localStorage.getItem(TM_RESULT_KEY);
          if (raw) {
            clearInterval(poll);
            localStorage.removeItem(TM_RESULT_KEY);
            localStorage.removeItem(TM_PENDING_KEY);
            try {
              const parsed = JSON.parse(raw) as { success: boolean; reason?: string };
              resolve(parsed);
            } catch {
              resolve({ success: true });
            }
            return;
          }
        } catch {}
        if (Date.now() - start > timeoutMs) {
          clearInterval(poll);
          localStorage.removeItem(TM_PENDING_KEY);
          // Timeout — consideramos enviado (a aba pode ter fechado antes de gravar)
          resolve({ success: true });
        }
      }, 500);
    });
  }, []);

  const runQueue = useCallback(async (queueItems: QueueItem[]) => {
    cancelRef.current = false;
    pauseRef.current = false;
    setRunning(true);
    setPaused(false);

    for (let i = 0; i < queueItems.length; i++) {
      // Verifica cancelamento
      if (cancelRef.current) break;

      // Verifica pausa — espera até despausar
      while (pauseRef.current) {
        await sleep(500);
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      const item = queueItems[i];
      setCurrentIdx(i);
      updateItem(i, { status: "sending" });

      const phone = sanitizePhone(item.phone);
      const encoded = encodeURIComponent(item.message);
      const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;

      // Abre o WhatsApp Web — o Tampermonkey vai clicar em enviar e fechar a aba
      window.open(url, "_blank", "noopener");

      // Aguarda o Tampermonkey gravar o resultado (timeout = 60s)
      const result = await waitForTampermonkey(item.id, 60_000);

      if (result.success) {
        updateItem(i, { status: "sent" });
        try {
          await updateProspect(item.id, { status: "primeiro_contato" });
        } catch (e) {
          console.error("[Disparo] updateProspect erro:", e);
        }
      } else {
        updateItem(i, { status: "failed", reason: result.reason });
        if (result.reason === "no_whatsapp") {
          try {
            await updateProspect(item.id, { whatsapp: "__sem_whatsapp__" });
          } catch {}
        }
      }

      // Delay entre disparos (exceto no último)
      if (i < queueItems.length - 1 && !cancelRef.current) {
        const ms = Math.floor(Math.random() * (delayMax - delayMin + 1) + delayMin) * 1000;
        const steps = ms / 500;
        for (let s = 0; s < steps; s++) {
          if (cancelRef.current) break;
          while (pauseRef.current) { await sleep(500); if (cancelRef.current) break; }
          await sleep(500);
        }
      }
    }

    setRunning(false);
    setPaused(false);
    cancelRef.current = false;
    pauseRef.current = false;

    const sent = queueItems.filter((_, i) => {
      // lê o estado final dos itens
      return true;
    }).length;
    toast.success("Fila de disparo finalizada!");
  }, [delayMin, delayMax, updateItem, waitForTampermonkey]);

  const handleDispatch = useCallback(() => {
    const selected = eligible.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;

    const queueItems: QueueItem[] = selected.map((p) => ({
      id: p.id,
      phone: p.whatsapp,
      company: p.company ?? p.id,
      message: pickNicheMessage(p.company ?? "", p.segment, null, "disparo-tab"),
      status: "pending",
    }));

    setItems(queueItems);
    setCurrentIdx(0);
    void runQueue(queueItems);
  }, [eligible, selectedIds, runQueue]);

  const handlePause = useCallback(() => {
    pauseRef.current = true;
    setPaused(true);
    toast.info("Disparo pausado. Clique em Retomar para continuar.");
  }, []);

  const handleResume = useCallback(() => {
    pauseRef.current = false;
    setPaused(false);
    toast.info("Disparo retomado.");
  }, []);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    pauseRef.current = false;
    setRunning(false);
    setPaused(false);
    toast.info("Disparo cancelado.");
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const sent = items.filter((i) => i.status === "sent").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const processed = sent + failed;
  const progressPct = items.length > 0 ? Math.round((processed / items.length) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Aviso Tampermonkey ── */}
      <section className="surface-card p-4 border border-primary/20 bg-primary/5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Requisito:</strong> instale a extensão{" "}
          <a
            href="https://www.tampermonkey.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Tampermonkey
          </a>{" "}
          e o script INFINDA (disponível em <strong>Cadência → aba Disparo</strong>).
          Feito isso, o disparo é 100% automático — sem servidor, sem configuração extra.
        </p>
      </section>

      {/* ── Fila ── */}
      <section className="surface-card p-4">
        <h3 className="text-sm font-semibold mb-3">
          Fila de Disparo ({eligible.length} prospects elegíveis)
        </h3>

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum prospect com status "Não contatado" e WhatsApp válido encontrado.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="select-all"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                disabled={running}
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer">
                Selecionar todos ({eligible.length})
              </Label>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 mb-4 pr-1">
              {eligible.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    id={`p-${p.id}`}
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                    disabled={running}
                  />
                  <Label htmlFor={`p-${p.id}`} className="flex-1 flex items-center gap-2 cursor-pointer text-sm">
                    <span className="font-medium truncate max-w-[180px]">{p.company}</span>
                    <span className="text-muted-foreground text-xs shrink-0">{p.whatsapp || p.phone}</span>
                    {p.segment && (
                      <span className="text-muted-foreground text-xs shrink-0 hidden sm:block">· {p.segment}</span>
                    )}
                  </Label>
                  <Badge variant="outline" className="text-xs shrink-0 bg-muted text-muted-foreground border-border">
                    Não contatado
                  </Badge>
                </div>
              ))}
            </div>

            {/* Delay */}
            <div className="flex items-end gap-4 mb-4">
              <div className="space-y-1">
                <Label htmlFor="delay-min" className="text-xs text-muted-foreground">Delay mínimo (s)</Label>
                <Input id="delay-min" type="number" min={10} max={delayMax - 1} value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value))} className="w-24" disabled={running} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="delay-max" className="text-xs text-muted-foreground">Delay máximo (s)</Label>
                <Input id="delay-max" type="number" min={delayMin + 1} max={600} value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value))} className="w-24" disabled={running} />
              </div>
            </div>

            {/* Botões */}
            <div className="flex flex-wrap gap-2">
              {!running ? (
                <Button onClick={handleDispatch} disabled={selectedIds.size === 0}>
                  <Send className="h-4 w-4 mr-1.5" />
                  Disparar selecionados ({selectedIds.size})
                </Button>
              ) : (
                <>
                  {paused ? (
                    <Button onClick={handleResume} variant="outline">
                      <Play className="h-4 w-4 mr-1.5" /> Retomar
                    </Button>
                  ) : (
                    <Button onClick={handlePause} variant="outline">
                      <Pause className="h-4 w-4 mr-1.5" /> Pausar
                    </Button>
                  )}
                  <Button onClick={handleCancel} variant="destructive">
                    <X className="h-4 w-4 mr-1.5" /> Cancelar
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── Status da fila ── */}
      {items.length > 0 && (
        <section className="surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Status da Fila</h3>
            <span className="text-xs text-muted-foreground">
              {processed}/{items.length} · {sent} enviado(s){failed > 0 && ` · ${failed} falha(s)`}
              {paused && " · Pausado"}
            </span>
          </div>
          <Progress value={progressPct} className="h-2 mb-3" />
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {items.map((item, i) => (
              <div key={item.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm">
                {item.status === "sent" && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                {item.status === "failed" && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                {item.status === "sending" && <Loader2 className="h-4 w-4 shrink-0 text-primary animate-spin" />}
                {item.status === "pending" && <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="flex-1 truncate font-medium">{item.company}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.status === "sent" && "Enviado"}
                  {item.status === "failed" && (item.reason === "no_whatsapp" ? "Sem WhatsApp" : "Falha")}
                  {item.status === "sending" && (i === currentIdx ? "Enviando…" : "Aguardando")}
                  {item.status === "pending" && "Aguardando"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
