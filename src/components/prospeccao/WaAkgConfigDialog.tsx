import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  loadWaAkgConfig,
  saveWaAkgConfig,
  testWaAkgConnection,
  disconnectWaAkgSession,
  type WaAkgConfig,
  type WaAkgSession,
} from "@/lib/whatsapp/wa-akg-client";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Server,
  Key,
  Smartphone,
  ExternalLink,
  QrCode,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface WaAkgConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: (config: WaAkgConfig) => void;
}

export function WaAkgConfigDialog({ open, onOpenChange, onConfigSaved }: WaAkgConfigDialogProps) {
  const [config, setConfig] = useState<WaAkgConfig>(loadWaAkgConfig());
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentSession, setCurrentSession] = useState<WaAkgSession | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevReadyRef = useRef<boolean | null>(null);

  // Função para verificar status do Gateway e obter QR ou dados da sessão
  const checkStatus = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await testWaAkgConnection({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    });
    if (!silent) setLoading(false);

    if (res.ok) {
      setServerError(null);
      const sessList = res.sessions ?? [];
      const target = sessList.find((s) => s.id === config.sessionId || s.name === config.sessionId) || sessList[0];
      if (target) {
        setCurrentSession(target);
        const isReady = target.status === "connected" || Boolean(target.ready);
        // Notificar se conectou agora
        if (prevReadyRef.current === false && isReady) {
          toast.success("🎉 WhatsApp Conectado com Sucesso!", {
            description: target.phone ? `Número: +${target.phone}` : "Disparos em segundo plano ativados.",
          });
        }
        prevReadyRef.current = isReady;
      } else {
        setCurrentSession(null);
      }
    } else {
      setServerError(res.error || "Gateway offline");
      setCurrentSession(null);
    }
  };

  // Ao abrir o diálogo, carrega config e inicia polling automático para leitura suave do QR Code
  useEffect(() => {
    if (open) {
      const cfg = loadWaAkgConfig();
      setConfig(cfg);
      prevReadyRef.current = null;
      void checkStatus(false);

      // Polling a cada 2.5s enquanto o modal estiver aberto
      pollTimerRef.current = setInterval(() => {
        void checkStatus(true);
      }, 2500);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [open]);

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar este WhatsApp? Será gerado um novo QR Code.")) {
      return;
    }
    setDisconnecting(true);
    const res = await disconnectWaAkgSession(config);
    setDisconnecting(false);
    if (res.ok) {
      toast.info("WhatsApp desconectado. Aguarde o novo QR Code...");
      prevReadyRef.current = false;
      void checkStatus(false);
    } else {
      toast.error(`Erro ao desconectar: ${res.error || "Falha na requisição"}`);
    }
  };

  const handleSave = () => {
    saveWaAkgConfig(config);
    toast.success("Configurações do WhatsApp salvas com sucesso!");
    onConfigSaved?.(config);
    onOpenChange(false);
  };

  const updateButtonText = (index: number, val: string) => {
    const list = [...config.interactiveButtons];
    list[index] = val;
    setConfig({ ...config, interactiveButtons: list });
  };

  const isConnected = currentSession?.status === "connected" || Boolean(currentSession?.ready);
  const qrCodeUrl = currentSession?.qr;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Conexão WhatsApp (Disparo Silencioso)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Conecte seu WhatsApp diretamente no INFINDA para disparos 100% em segundo plano (sem abrir abas).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Card Principal de Conexão */}
          {serverError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive space-y-2.5">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <XCircle className="h-5 w-5 shrink-0" />
                <span>Servidor Gateway Local Offline</span>
              </div>
              <p className="text-xs leading-relaxed text-destructive/90">
                Não conseguimos conectar em <code className="bg-destructive/20 px-1.5 py-0.5 rounded text-[11px] font-mono">{config.apiUrl}</code>.
              </p>
              <div className="rounded-lg bg-background/80 border border-border p-2.5 text-[11px] text-foreground font-mono">
                npm run gateway
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => checkStatus(false)}
                  disabled={loading}
                  className="h-7 text-xs gap-1 border-destructive/40 hover:bg-destructive/10"
                >
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Tentar Novamente
                </Button>
              </div>
            </div>
          ) : isConnected ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <span className="font-semibold text-sm text-emerald-400">WhatsApp Conectado e Ativo</span>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/20 text-emerald-300 text-[10px]">
                  Online
                </Badge>
              </div>

              <div className="flex items-center gap-3 bg-card/60 rounded-lg p-3 border border-emerald-500/20">
                <Smartphone className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground">Número Conectado:</div>
                  <div className="text-sm font-semibold font-mono text-foreground">
                    {currentSession?.phone ? `+${currentSession.phone}` : "Dispositivo Pareado"}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                >
                  {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  Desconectar
                </Button>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-emerald-300/90 pt-1">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Os disparos na tela de Prospecção serão enviados diretamente sem abrir nenhuma janela do navegador.</span>
              </div>
            </div>
          ) : qrCodeUrl ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground">
                <QrCode className="h-4 w-4 text-emerald-400" />
                <span>Escaneie o QR Code abaixo com seu WhatsApp</span>
              </div>

              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No seu celular, abra o <strong>WhatsApp</strong> &gt; toque nos <strong>3 pontinhos (ou Configurações)</strong> &gt; <strong>Aparelhos conectados</strong> &gt; <strong>Conectar um aparelho</strong>.
              </p>

              <div className="relative inline-block mx-auto rounded-xl border-2 border-emerald-500/30 p-2.5 bg-white shadow-xl animate-in zoom-in-95">
                <img
                  src={qrCodeUrl}
                  alt="QR Code WhatsApp"
                  width={240}
                  height={240}
                  className="block mx-auto rounded-lg"
                />
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                <span>Aguardando leitura do QR Code... Esta tela atualizará automaticamente.</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card/60 p-6 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <p className="font-medium text-xs">Inicializando sessão do WhatsApp...</p>
              <p className="text-[11px] text-muted-foreground">Gerando QR Code de pareamento seguro...</p>
            </div>
          )}

          {/* Botão de Toggle para Configurações Avançadas */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition"
            >
              <span className="flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-primary" />
                Configurações Avançadas e Botões Interativos
              </span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Bloco Avançado */}
          {showAdvanced && (
            <div className="space-y-3.5 rounded-xl border border-border bg-card/40 p-3.5 pt-3 animate-in fade-in">
              {/* URL da API */}
              <div className="space-y-1">
                <Label htmlFor="wa-api-url" className="text-xs flex items-center justify-between">
                  <span>URL do Servidor Gateway</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Padrão: http://localhost:3000</span>
                </Label>
                <div className="relative">
                  <Server className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="wa-api-url"
                    placeholder="http://localhost:3000"
                    value={config.apiUrl}
                    onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1">
                <Label htmlFor="wa-api-key" className="text-xs flex items-center justify-between">
                  <span>Chave de API (Opcional para local)</span>
                  <span className="text-[10px] text-muted-foreground font-normal">X-API-Key</span>
                </Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="wa-api-key"
                    type="password"
                    placeholder="Deixe em branco para o gateway local"
                    value={config.apiKey}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    className="pl-8 text-xs font-mono h-8"
                  />
                </div>
              </div>

              {/* Session ID */}
              <div className="space-y-1">
                <Label htmlFor="wa-session-id" className="text-xs flex items-center justify-between">
                  <span>ID da Sessão</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Padrão: default</span>
                </Label>
                <div className="relative">
                  <Smartphone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="wa-session-id"
                    placeholder="default"
                    value={config.sessionId}
                    onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
                    className="pl-8 text-xs h-8"
                  />
                </div>
              </div>

              {/* Botões Interativos Quick Reply */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>Botões de Resposta Rápida</span>
                      <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                        Quick Reply
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Anexa botões de clique rápido no rodapé das mensagens enviadas.
                    </p>
                  </div>
                  <Switch
                    checked={config.useInteractive}
                    onCheckedChange={(checked) => setConfig({ ...config, useInteractive: checked })}
                  />
                </div>

                {config.useInteractive && (
                  <div className="space-y-1.5 pt-1.5 border-t border-border/50">
                    <Label className="text-[10px] text-muted-foreground">Opções dos botões:</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        value={config.interactiveButtons[0] || ""}
                        onChange={(e) => updateButtonText(0, e.target.value)}
                        placeholder="Opção 1"
                        className="h-7 text-xs"
                        maxLength={20}
                      />
                      <Input
                        value={config.interactiveButtons[1] || ""}
                        onChange={(e) => updateButtonText(1, e.target.value)}
                        placeholder="Opção 2"
                        className="h-7 text-xs"
                        maxLength={20}
                      />
                      <Input
                        value={config.interactiveButtons[2] || ""}
                        onChange={(e) => updateButtonText(2, e.target.value)}
                        placeholder="Opção 3"
                        className="h-7 text-xs"
                        maxLength={20}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rodapé explicativo */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>Baileys Gateway Local (Zero Bloqueio de Telas)</span>
            <button
              type="button"
              onClick={() => checkStatus(false)}
              disabled={loading}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar Status
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>
          <Button type="button" size="sm" onClick={handleSave} className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
            Salvar e Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
