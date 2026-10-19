import { useState, useEffect } from "react";
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
  type WaAkgConfig,
  type WaAkgSession,
} from "@/lib/whatsapp/wa-akg-client";
import { CheckCircle2, XCircle, Loader2, Sparkles, Server, Key, Smartphone, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface WaAkgConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSaved?: (config: WaAkgConfig) => void;
}

export function WaAkgConfigDialog({ open, onOpenChange, onConfigSaved }: WaAkgConfigDialogProps) {
  const [config, setConfig] = useState<WaAkgConfig>(loadWaAkgConfig());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    ok: boolean;
    message: string;
    sessions?: WaAkgSession[];
  }>({
    tested: false,
    ok: false,
    message: "",
  });

  useEffect(() => {
    if (open) {
      setConfig(loadWaAkgConfig());
      setTestResult({ tested: false, ok: false, message: "" });
    }
  }, [open]);

  const handleTest = async () => {
    if (!config.apiUrl.trim()) {
      toast.error("Informe a URL do Gateway WA-AKG");
      return;
    }
    setTesting(true);
    setTestResult({ tested: false, ok: false, message: "" });

    const res = await testWaAkgConnection({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    });

    setTesting(false);
    if (res.ok) {
      const sessList = res.sessions ?? [];
      const sessionCount = sessList.length;
      const targetSession = sessList.find((s) => s.id === config.sessionId || s.name === config.sessionId);
      const isTargetReady = targetSession ? (targetSession.status === "connected" || targetSession.ready) : false;

      let msg = `Conexão estabelecida! (${sessionCount} sessões encontradas).`;
      if (config.sessionId) {
        msg += targetSession
          ? ` Sessão '${config.sessionId}': ${isTargetReady ? "🟢 Conectada" : "🟡 Registrada / Aguardando QR"}`
          : ` ⚠️ Sessão '${config.sessionId}' ainda não criada no Gateway.`;
      }

      setTestResult({
        tested: true,
        ok: true,
        message: msg,
        sessions: sessList,
      });
      toast.success("Gateway WA-AKG online!");
    } else {
      setTestResult({
        tested: true,
        ok: false,
        message: res.error || "Falha ao contactar o servidor.",
      });
      toast.error("Não foi possível conectar ao WA-AKG.");
    }
  };

  const handleSave = () => {
    saveWaAkgConfig(config);
    toast.success("Configurações do WA-AKG salvas!");
    onConfigSaved?.(config);
    onOpenChange(false);
  };

  const updateButtonText = (index: number, val: string) => {
    const list = [...config.interactiveButtons];
    list[index] = val;
    setConfig({ ...config, interactiveButtons: list });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Configuração do Gateway WA-AKG v1.7.0</DialogTitle>
              <DialogDescription className="text-xs">
                Dispare mensagens automaticamente em segundo plano via Baileys v7 REST API.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Status do teste */}
          {testResult.tested && (
            <div
              className={`flex items-start gap-2.5 rounded-lg border p-3 ${
                testResult.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              )}
              <div className="flex-1 leading-snug">
                <p className="font-semibold">{testResult.ok ? "Conexão Bem-sucedida" : "Erro na Conexão"}</p>
                <p className="mt-0.5 text-[11px] opacity-90">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* URL da API */}
          <div className="space-y-1.5">
            <Label htmlFor="wa-api-url" className="text-xs flex items-center justify-between">
              <span>URL do Servidor WA-AKG</span>
              <span className="text-[10px] text-muted-foreground font-normal">Padrão local: http://localhost:3000</span>
            </Label>
            <div className="relative">
              <Server className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="wa-api-url"
                placeholder="http://localhost:3000 ou https://seu-wa-gateway.com"
                value={config.apiUrl}
                onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                className="pl-8 text-xs"
              />
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label htmlFor="wa-api-key" className="text-xs flex items-center justify-between">
              <span>Chave de API (X-API-Key)</span>
              <span className="text-[10px] text-muted-foreground font-normal">Obtida no Dashboard do WA-AKG (Settings → API Keys)</span>
            </Label>
            <div className="relative">
              <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="wa-api-key"
                type="password"
                placeholder="wag_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                className="pl-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Session ID */}
          <div className="space-y-1.5">
            <Label htmlFor="wa-session-id" className="text-xs flex items-center justify-between">
              <span>Nome ou ID da Sessão</span>
              <span className="text-[10px] text-muted-foreground font-normal">Nome do WhatsApp conectado no painel</span>
            </Label>
            <div className="relative">
              <Smartphone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="wa-session-id"
                placeholder="default (ou nome da sessão)"
                value={config.sessionId}
                onChange={(e) => setConfig({ ...config, sessionId: e.target.value })}
                className="pl-8 text-xs"
              />
            </div>
          </div>

          {/* Novidade v1.7.0: Mensagens Interativas com Botões */}
          <div className="rounded-lg border border-border bg-card/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span>Botões Interativos (Novidade v1.7.0)</span>
                  <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
                    Quick Reply
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Anexa botões de resposta rápida ao fim da mensagem para o cliente responder com 1 toque.
                </p>
              </div>
              <Switch
                checked={config.useInteractive}
                onCheckedChange={(checked) => setConfig({ ...config, useInteractive: checked })}
              />
            </div>

            {config.useInteractive && (
              <div className="space-y-2 pt-1 border-t border-border/50">
                <Label className="text-[11px] text-muted-foreground">Textos dos Botões (até 3 opções):</Label>
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

          {/* Link para repositório oficial */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>Powered by WA-AKG (Baileys v7)</span>
            <a
              href="https://github.com/mrifqidaffaaditya/WA-AKG"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Ver repositório no GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="text-xs"
          >
            {testing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Testar Conexão
          </Button>
          <Button type="button" size="sm" onClick={handleSave} className="text-xs">
            Salvar e Ativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
