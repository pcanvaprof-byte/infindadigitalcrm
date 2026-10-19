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
  Settings2,
  Zap,
  Globe,
  QrCode,
} from "lucide-react";
import type { Prospect } from "@/lib/mock-prospects";
import { updateProspect } from "@/lib/prospects-api";
import { pickNicheMessage } from "@/lib/prospeccao/niche-templates";
import {
  loadWaAkgConfig,
  sendWaAkgMessage,
  testWaAkgConnection,
  type WaAkgConfig,
} from "@/lib/whatsapp/wa-akg-client";
import { WaAkgConfigDialog } from "./WaAkgConfigDialog";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisparoWhatsAppProps {
  prospects: Prospect[];
}

type ItemStatus = "pending" | "sending" | "sent" | "failed";
type DisparoEngine = "wa-akg" | "tampermonkey";

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
const TM_RESULT_KEY = "infinda_disparo_result";
const TM_PENDING_KEY = "infinda_disparo_pending";

// ─── Component ───────────────────────────────────────────────────────────────

export function DisparoWhatsApp({ prospects }: DisparoWhatsAppProps) {
  // ── Motor de Disparo ──────────────────────────────────────────────────────
  const [engine, setEngine] = useState<DisparoEngine>("wa-akg");
  const [configOpen, setConfigOpen] = useState(false);
  const [akgConfig, setAkgConfig] = useState<WaAkgConfig>(loadWaAkgConfig());

  // ── Seleção ──────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [delayMin, setDelayMin] = useState(15);
  const [delayMax, setDelayMax] = useState(30);

  // ── Fila ─────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);

  const [gatewayStatus, setGatewayStatus] = useState<"connected" | "qr_ready" | "offline" | "checking">("checking");
  const [gatewayPhone, setGatewayPhone] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const cfg = loadWaAkgConfig();
      setAkgConfig(cfg);
      const res = await testWaAkgConnection({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
      if (res.ok) {
        const sessList = res.sessions ?? [];
        const target = sessList.find((s) => s.id === cfg.sessionId || s.name === cfg.sessionId) || sessList[0];
        if (target && (target.status === "connected" || target.ready)) {
          setGatewayStatus("connected");
          setGatewayPhone(target.phone || null);
        } else {
          setGatewayStatus("qr_ready");
          setGatewayPhone(null);
        }
      } else {
        setGatewayStatus("offline");
        setGatewayPhone(null);
      }
    } catch {
      setGatewayStatus("offline");
      setGatewayPhone(null);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
    const interval = setInterval(() => {
      void checkStatus();
    }, 10_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

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

  const updateItem = useCallback((idx: number, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  }, []);

  const waitForTampermonkey = useCallback((
    prospectId: string,
    timeoutMs: number,
  ): Promise<{ success: boolean; reason?: string }> => {
    return new Promise((resolve) => {
      const start = Date.now();
      try { localStorage.removeItem(TM_RESULT_KEY); } catch {}
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
      if (cancelRef.current) break;

      while (pauseRef.current) {
        await sleep(500);
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      const item = queueItems[i];
      setCurrentIdx(i);
      updateItem(i, { status: "sending" });

      if (engine === "wa-akg") {
        // Disparo via Gateway WA-AKG v1.7.0 (REST API / Background)
        const result = await sendWaAkgMessage({
          phone: item.phone,
          message: item.message,
          config: akgConfig,
        });

        if (result.success) {
          updateItem(i, { status: "sent" });
          try {
            await updateProspect(item.id, { status: "primeiro_contato" });
          } catch (e) {
            console.error("[Disparo WA-AKG] updateProspect erro:", e);
          }
        } else {
          updateItem(i, { status: "failed", reason: result.error });
        }
      } else {
        // Disparo via Tampermonkey + WhatsApp Web
        const phone = sanitizePhone(item.phone);
        const encoded = encodeURIComponent(item.message);
        const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;

        window.open(url, "_blank", "noopener");
        const result = await waitForTampermonkey(item.id, 60_000);

        if (result.success) {
          updateItem(i, { status: "sent" });
          try {
            await updateProspect(item.id, { status: "primeiro_contato" });
          } catch (e) {
            console.error("[Disparo TM] updateProspect erro:", e);
          }
        } else {
          updateItem(i, { status: "failed", reason: result.reason });
          if (result.reason === "no_whatsapp") {
            try {
              await updateProspect(item.id, { whatsapp: "__sem_whatsapp__" });
            } catch {}
          }
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

    toast.success("Fila de disparo finalizada!");
  }, [engine, akgConfig, delayMin, delayMax, updateItem, waitForTampermonkey]);

  const handleDispatch = useCallback(() => {
    const selected = eligible.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;

    if (engine === "wa-akg" && !akgConfig.apiUrl.trim()) {
      toast.error("Configure a URL do Gateway WA-AKG antes de iniciar");
      setConfigOpen(true);
      return;
    }

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
  }, [eligible, selectedIds, engine, akgConfig, runQueue]);

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
      {/* ── Seleção do Motor ── */}
      <section className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              Motor de Envio de WhatsApp
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Escolha como o sistema deve processar o envio em massa para os prospects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={engine === "wa-akg" ? "default" : "outline"}
              size="sm"
              onClick={() => setEngine("wa-akg")}
              disabled={running}
              className="text-xs h-8"
            >
              <Zap className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              WA-AKG v1.7.0 (API Gateway)
            </Button>
            <Button
              type="button"
              variant={engine === "tampermonkey" ? "default" : "outline"}
              size="sm"
              onClick={() => setEngine("tampermonkey")}
              disabled={running}
              className="text-xs h-8"
            >
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              Tampermonkey (Web)
            </Button>
            {engine === "wa-akg" && (
              <>
                {gatewayStatus === "connected" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfigOpen(true)}
                    className="text-xs h-8 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    title="WhatsApp conectado e pronto"
                  >
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Conectado {gatewayPhone ? `(+${gatewayPhone})` : ""}
                    <Settings2 className="h-3 w-3 ml-1 opacity-70" />
                  </Button>
                ) : gatewayStatus === "qr_ready" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfigOpen(true)}
                    className="text-xs h-8 border-amber-500/50 bg-amber-500/20 text-amber-300 font-medium hover:bg-amber-500/30 animate-pulse"
                    title="Clique para escanear o QR Code no INFINDA"
                  >
                    <QrCode className="h-3.5 w-3.5 mr-1 text-amber-400" />
                    📲 Conectar WhatsApp
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfigOpen(true)}
                    className="text-xs h-8"
                    title="Configurar servidor WA-AKG"
                  >
                    <Settings2 className="h-3.5 w-3.5 mr-1" />
                    Configurar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {engine === "wa-akg" ? (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-emerald-400">Modo Gateway Ativo:</span> Os disparos ocorrem 100% em segundo plano através do servidor WA-AKG (Baileys v7). <strong>Não abre abas no navegador</strong> e permite anexar botões interativos nativos do WhatsApp aos disparos.
          </div>
        ) : (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">Requisito:</strong> instale a extensão{" "}
            <a
              href="https://www.tampermonkey.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Tampermonkey
            </a>{" "}
            e o script INFINDA. O navegador abrirá abas do WhatsApp Web sequencialmente para cada disparo.
          </div>
        )}
      </section>

      {/* ── Fila ── */}
      <section className="rounded-xl border border-border bg-card p-4">
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
                <Input id="delay-min" type="number" min={5} max={delayMax - 1} value={delayMin}
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
        <section className="rounded-xl border border-border bg-card p-4">
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
                  {item.status === "failed" && (item.reason || "Falha")}
                  {item.status === "sending" && (i === currentIdx ? "Enviando…" : "Aguardando")}
                  {item.status === "pending" && "Aguardando"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dialog de Configuração do WA-AKG */}
      <WaAkgConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        onConfigSaved={(saved) => setAkgConfig(saved)}
      />
    </div>
  );
}
