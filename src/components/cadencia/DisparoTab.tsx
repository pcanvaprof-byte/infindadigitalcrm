import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Download, CheckCircle2 } from "lucide-react";

const SCRIPT_CONTENT = `// ==UserScript==
// @name         INFINDA - Auto Disparar WhatsApp
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Envia mensagem automaticamente no WhatsApp Web e notifica o CRM INFINDA
// @author       INFINDA
// @match        https://web.whatsapp.com/send?*
// @grant        window.close
// ==/UserScript==

(function() {
    'use strict';

    const MAX_WAIT = 60000;
    const start = Date.now();

    const disparar = setInterval(() => {
        if (Date.now() - start > MAX_WAIT) {
            clearInterval(disparar);
            notificar(false, 'timeout');
            fechar();
            return;
        }

        const btn = document.querySelector('span[data-icon="send"]') ||
                    document.querySelector('button[aria-label="Enviar"]') ||
                    document.querySelector('button[aria-label="Send"]');

        if (btn) {
            clearInterval(disparar);
            btn.click();
            console.log('[INFINDA] Mensagem enviada!');
            setTimeout(() => { notificar(true); fechar(); }, 3000);
        }
    }, 1000);

    function notificar(success, reason) {
        try {
            localStorage.setItem('infinda_disparo_result', JSON.stringify({
                success: success,
                reason: reason || null,
                ts: Date.now()
            }));
        } catch(e) {}
    }

    function fechar() {
        try { window.close(); } catch(e) {}
    }
})();`;

export default function DisparoTab() {
  const [scriptDownloaded, setScriptDownloaded] = useState(false);
  const navigate = useNavigate();

  const handleDownloadScript = () => {
    const blob = new Blob([SCRIPT_CONTENT], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "infinda-auto-disparar.user.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setScriptDownloaded(true);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configure o disparo automático</h2>
        <p className="text-muted-foreground mt-1">
          Faça uma vez só. Depois é só selecionar e disparar.
        </p>
      </div>

      {/* Step 1 */}
      <Card className="hover:border-primary/60 cursor-pointer transition-colors border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shrink-0">
              1
            </span>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              Instale o Tampermonkey
            </div>
            <Badge className="ml-auto bg-green-600 text-white hover:bg-green-600">Grátis</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pl-6">
          <p className="text-sm text-muted-foreground">
            Extensão gratuita para Chrome, Edge e Firefox
          </p>
          <Button
            size="lg"
            onClick={() => window.open("https://www.tampermonkey.net/", "_blank")}
          >
            Instalar Tampermonkey →
          </Button>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card className="hover:border-primary/60 cursor-pointer transition-colors border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold shrink-0">
              2
            </span>
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-muted-foreground" />
              Instale o script INFINDA
            </div>
            <Badge className="ml-auto bg-blue-600 text-white hover:bg-blue-600">Uma vez só</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pl-6">
          <p className="text-sm text-muted-foreground">
            Clique abaixo para baixar e instale no Tampermonkey
          </p>
          <Button size="lg" variant="outline" onClick={handleDownloadScript}>
            Baixar script INFINDA →
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation card */}
      {scriptDownloaded && (
        <Card className="border-green-600/60 bg-green-950/20">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-green-500 font-semibold text-base">
              <CheckCircle2 className="h-6 w-6" />
              Tudo pronto! Agora vá em Prospecção → Disparo WhatsApp e dispare.
            </div>
            <Button
              size="lg"
              onClick={() => navigate({ to: "/prospeccao" })}
            >
              Ir para Prospecção →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Só funciona no PC (Chrome/Edge/Firefox). No celular o envio é manual.
      </p>
    </div>
  );
}
