import { useState, useEffect, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  Smartphone,
  Send,
  X,
  RefreshCw,
} from "lucide-react";
import type { Prospect } from "@/lib/mock-prospects";
import { updateProspect } from "@/lib/prospects-api";
import { pickNicheMessage } from "@/lib/prospeccao/niche-templates";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisparoWhatsAppProps {
  prospects: Prospect[];
}

interface ConnectionState {
  connected: boolean;
  phone?: string;
}

type QueueItemStatus = "pending" | "sending" | "sent" | "failed";

interface QueueItem {
  id: string;
  phone: string;
  company: string;
  message: string;
  status: QueueItemStatus;
  reason?: string;
}

interface QueueState {
  running: boolean;
  items: QueueItem[];
  total: number;
  sent: number;
  failed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVER_URL = "http://localhost:3333";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isPhoneValid(raw: string): boolean {
  return sanitizePhone(raw).length >= 10;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DisparoWhatsApp({ prospects }: DisparoWhatsAppProps) {
  // ── Connection state ──────────────────────────────────────────────────────
  const [connection, setConnection] = useState<ConnectionState>({
    connected: false,
  });
  const [serverOffline, setServerOffline] = useState(false);

  // ── QR Dialog ────────────────────────────────────────────────────────────
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // ── Queue state ──────────────────────────────────────────────────────────
  const [queueState, setQueueState] = useState<QueueState>({
    running: false,
    items: [],
    total: 0,
    sent: 0,
    failed: 0,
  });

  // ── Selection & config ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [delayMin, setDelayMin] = useState(80);
  const [delayMax, setDelayMax] = useState(100);

  // Refs for intervals so cleanup is always correct
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track which IDs have already been processed to avoid calling updateProspect twice
  const processedIdsRef = useRef<Set<string>>(new Set());

  // ── Filter eligible prospects ─────────────────────────────────────────────
  const eligible = prospects.filter(
    (p) =>
      p.status === "nao_contatado" &&
      isPhoneValid(p.whatsapp || ""),
  );

  // ── Connection polling ────────────────────────────────────────────────────
  // O browser bloqueia fetch HTTP→HTTPS (Mixed Content). Por isso não
  // conseguimos checar o status automaticamente. O usuário confirma manualmente.
  const [manualConnected, setManualConnected] = useState(() => {
    try { return window.localStorage.getItem("infinda_wa_connected") === "1"; } catch { return false; }
  });

  const confirmConnected = useCallback(() => {
    setManualConnected(true);
    setServerOffline(false);
    setConnection({ connected: true });
    try { window.localStorage.setItem("infinda_wa_connected", "1"); } catch {}
    toast.success("WhatsApp marcado como conectado! Pode disparar.");
  }, []);

  const disconnectManual = useCallback(() => {
    setManualConnected(false);
    setConnection({ connected: false });
    setServerOffline(true);
    try { window.localStorage.removeItem("infinda_wa_connected"); } catch {}
  }, []);

  // Sync connection state with manual flag on mount
  useEffect(() => {
    if (manualConnected) {
      setConnection({ connected: true });
      setServerOffline(false);
    } else {
      setServerOffline(true);
    }
  }, [manualConnected]);

  // ── QR Code fetching ──────────────────────────────────────────────────────
  const fetchQr = useCallback(async () => {
    setQrLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/qr`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        setQrDataUrl(null);
        return;
      }
      const data = await res.json() as { qr?: string | null };
      setQrDataUrl(data.qr ?? null);
    } catch {
      setQrDataUrl(null);
    } finally {
      setQrLoading(false);
    }
  }, []);

  const openQrDialog = useCallback(() => {
    // O browser bloqueia chamadas HTTP vindas de HTTPS (Mixed Content).
    // A solução é abrir o servidor local numa nova aba — lá o QR Code aparece.
    window.open("http://localhost:3333", "_blank", "noopener,noreferrer");
    toast.info("Escaneie o QR Code na aba que abriu. Volte aqui após conectar.");
  }, []);

  const closeQrDialog = useCallback(() => {
    setQrOpen(false);
    setQrDataUrl(null);
    if (qrIntervalRef.current !== null) {
      clearInterval(qrIntervalRef.current);
      qrIntervalRef.current = null;
    }
  }, []);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allSelected =
    eligible.length > 0 && eligible.every((p) => selectedIds.has(p.id));
  const someSelected = eligible.some((p) => selectedIds.has(p.id));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligible.map((p) => p.id)));
    }
  }, [allSelected, eligible]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── Queue polling & side-effects ──────────────────────────────────────────
  const pollQueue = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/queue`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return;
      const data = await res.json() as QueueState;
      setQueueState(data);

      // Process newly completed items
      for (const item of data.items) {
        if (processedIdsRef.current.has(item.id)) continue;
        if (item.status === "sent") {
          processedIdsRef.current.add(item.id);
          void updateProspect(item.id, { status: "primeiro_contato" }).catch((err: unknown) => {
            console.error("[DisparoWhatsApp] updateProspect sent error", err);
          });
        } else if (item.status === "failed" && item.reason === "no_whatsapp") {
          processedIdsRef.current.add(item.id);
          void updateProspect(item.id, { whatsapp: "__sem_whatsapp__" }).catch((err: unknown) => {
            console.error("[DisparoWhatsApp] updateProspect no_whatsapp error", err);
          });
        }
      }

      // Stop polling when queue is done
      if (!data.running) {
        if (queueIntervalRef.current !== null) {
          clearInterval(queueIntervalRef.current);
          queueIntervalRef.current = null;
        }
        if (data.total > 0) {
          toast.success(`Disparo concluído: ${data.sent} enviado(s), ${data.failed} falha(s).`);
        }
      }
    } catch {
      // server may have gone offline; stop polling silently
      if (queueIntervalRef.current !== null) {
        clearInterval(queueIntervalRef.current);
        queueIntervalRef.current = null;
      }
    }
  }, []);

  // Cleanup queue polling on unmount
  useEffect(() => {
    return () => {
      if (queueIntervalRef.current !== null) clearInterval(queueIntervalRef.current);
    };
  }, []);

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const handleDispatch = useCallback(async () => {
    const selected = eligible.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;

    const items = selected.map((p) => ({
      id: p.id,
      phone: sanitizePhone(p.whatsapp),
      company: p.company,
      message: pickNicheMessage(
        p.company ?? "",
        p.segment,
        null,
        "disparo-tab",
      ),
    }));

    try {
      const res = await fetch(`${SERVER_URL}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, delayMin, delayMax }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        toast.error("Falha ao iniciar a fila de disparo.");
        return;
      }

      processedIdsRef.current = new Set();
      toast.success(`Fila iniciada com ${items.length} contato(s).`);

      // Start polling queue state
      void pollQueue();
      queueIntervalRef.current = setInterval(() => {
        void pollQueue();
      }, 2000);
    } catch {
      toast.error("Não foi possível conectar ao servidor de disparo.");
    }
  }, [eligible, selectedIds, delayMin, delayMax, pollQueue]);

  // ── Cancel queue ─────────────────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    try {
      await fetch(`${SERVER_URL}/queue`, {
        method: "DELETE",
        signal: AbortSignal.timeout(4000),
      });
      if (queueIntervalRef.current !== null) {
        clearInterval(queueIntervalRef.current);
        queueIntervalRef.current = null;
      }
      setQueueState((prev) => ({ ...prev, running: false }));
      toast.info("Fila de disparo cancelada.");
    } catch {
      toast.error("Erro ao cancelar a fila.");
    }
  }, []);

  // ── Progress calculation ──────────────────────────────────────────────────
  const progressPct =
    queueState.total > 0
      ? Math.round(((queueState.sent + queueState.failed) / queueState.total) * 100)
      : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Connection section ── */}
      <section className="surface-card p-4">
        <h3 className="text-sm font-semibold mb-3">Conexão WhatsApp</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {serverOffline ? (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <WifiOff className="h-4 w-4 text-destructive" />
                Servidor offline — inicie o servidor para usar o disparo
              </div>
              <Button size="sm" variant="outline" onClick={() => window.open("http://localhost:3333", "_blank", "noopener,noreferrer")}>
                <Smartphone className="h-4 w-4 mr-1.5" />
                Abrir servidor
              </Button>
              <Button size="sm" onClick={confirmConnected}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Já conectei ✅
              </Button>
            </div>
          ) : connection.connected ? (
            <>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-7" onClick={disconnectManual}>
                <X className="h-3 w-3 mr-1" /> Desconectar
              </Button>
            </>
          ) : (
            <>
              <Badge variant="destructive">
                <WifiOff className="h-3 w-3 mr-1" />
                Desconectado
              </Badge>
              <Button size="sm" variant="outline" onClick={openQrDialog}>
                <Smartphone className="h-4 w-4 mr-1.5" />
                Conectar
              </Button>
            </>
          )}
        </div>
      </section>

      {/* ── QR Code Dialog ── */}
      <Dialog open={qrOpen} onOpenChange={(open) => { if (!open) closeQrDialog(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Escanear QR Code</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no seu celular, vá em Dispositivos vinculados e
              escaneie o código abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrLoading && !qrDataUrl ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando QR Code…
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code WhatsApp"
                className="w-56 h-56 rounded-md border border-border"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-muted-foreground text-sm">
                <XCircle className="h-8 w-8 text-destructive" />
                <span>Não foi possível gerar o QR Code.</span>
                <Button size="sm" variant="outline" onClick={() => void fetchQr()}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Queue configuration section ── */}
      <section className="surface-card p-4 mt-4">
        <h3 className="text-sm font-semibold mb-3">
          Fila de Disparo ({eligible.length} prospects elegíveis)
        </h3>

        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum prospect com status "Não contatado" e WhatsApp válido encontrado.
          </p>
        ) : (
          <>
            {/* Select all */}
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="select-all"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer">
                Selecionar todos ({eligible.length})
              </Label>
            </div>

            {/* Prospect list */}
            <div className="max-h-64 overflow-y-auto space-y-1.5 mb-4 pr-1">
              {eligible.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40 transition-colors"
                >
                  <Checkbox
                    id={`prospect-${p.id}`}
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                  />
                  <Label
                    htmlFor={`prospect-${p.id}`}
                    className="flex-1 flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <span className="font-medium truncate max-w-[180px]">{p.company}</span>
                    <span className="text-muted-foreground text-xs shrink-0">
                      {p.whatsapp || p.phone}
                    </span>
                    {p.segment && (
                      <span className="text-muted-foreground text-xs shrink-0 hidden sm:block">
                        · {p.segment}
                      </span>
                    )}
                  </Label>
                  <Badge
                    variant="outline"
                    className="text-xs shrink-0 bg-muted text-muted-foreground border-border"
                  >
                    Não contatado
                  </Badge>
                </div>
              ))}
            </div>

            {/* Delay config */}
            <div className="flex items-end gap-4 mb-4">
              <div className="space-y-1">
                <Label htmlFor="delay-min" className="text-xs text-muted-foreground">
                  Delay mínimo (s)
                </Label>
                <Input
                  id="delay-min"
                  type="number"
                  min={10}
                  max={delayMax - 1}
                  value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="delay-max" className="text-xs text-muted-foreground">
                  Delay máximo (s)
                </Label>
                <Input
                  id="delay-max"
                  type="number"
                  min={delayMin + 1}
                  max={600}
                  value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value))}
                  className="w-24"
                />
              </div>
            </div>

            {/* Dispatch button */}
            <Button
              onClick={() => void handleDispatch()}
              disabled={selectedIds.size === 0 || !connection.connected || queueState.running}
              className="w-full sm:w-auto"
            >
              {queueState.running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Disparando…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Disparar selecionados ({selectedIds.size})
                </>
              )}
            </Button>
          </>
        )}
      </section>

      {/* ── Queue status section (only when there's a queue) ── */}
      {queueState.total > 0 && (
        <section className="surface-card p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Status da Fila</h3>
            {queueState.running && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleCancel()}
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancelar fila
              </Button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-3 space-y-1.5">
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {queueState.sent + queueState.failed} de {queueState.total} processados
              &nbsp;·&nbsp;
              {queueState.sent} enviado(s)
              {queueState.failed > 0 && (
                <span className="text-destructive"> · {queueState.failed} falha(s)</span>
              )}
            </p>
          </div>

          {/* Item list */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {queueState.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
              >
                {item.status === "sent" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
                {item.status === "failed" && (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                {(item.status === "pending" || item.status === "sending") && (
                  <Loader2
                    className={`h-4 w-4 shrink-0 text-muted-foreground ${
                      item.status === "sending" ? "animate-spin" : ""
                    }`}
                  />
                )}
                <span className="flex-1 truncate font-medium">{item.company}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.status === "sent" && "Enviado"}
                  {item.status === "failed" && (item.reason === "no_whatsapp" ? "Sem WhatsApp" : "Falha")}
                  {item.status === "pending" && "Aguardando"}
                  {item.status === "sending" && "Enviando…"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
