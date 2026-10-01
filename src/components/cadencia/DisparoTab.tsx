import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Copy, QrCode, Zap, ArrowRight, Smartphone } from "lucide-react";
import { toast } from "sonner";

// Script Tampermonkey v2 — integrado ao CRM INFINDA via localStorage
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

const STEPS = [
  {
    icon: Download,
    title: "Instale o Tampermonkey (uma vez só)",
    description: (
      <>
        Acesse{" "}
        <a href="https://www.tampermonkey.net/" target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2">
          tampermonkey.net
        </a>{" "}
        e instale a extensão no Chrome. É gratuito e leva menos de 1 minuto.
      </>
    ),
  },
  {
    icon: QrCode,
    title: "Instale o script INFINDA (uma vez só)",
    description: (
      <>
        Clique em <strong>"Baixar script"</strong> abaixo. O Tampermonkey vai abrir e pedir para instalar.
        Clique em <strong>"Instalar"</strong>. Pronto — não precisa fazer mais nada.
      </>
    ),
  },
  {
    icon: Zap,
    title: "Selecione e dispare",
    description: (
      <>
        Vá em <strong>Prospecção → aba Disparo WhatsApp</strong>, selecione os prospects,
        configure o delay e clique <strong>"Disparar selecionados"</strong>.
        O CRM abre o WhatsApp Web, o script envia automaticamente, fecha a aba e passa para o próximo.
      </>
    ),
  },
];

export function DisparoTab() {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([SCRIPT_CONTENT], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "infinda-auto-disparar.user.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Script baixado! Abra o arquivo para instalar no Tampermonkey.");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SCRIPT_CONTENT);
      setCopied(true);
      toast.success("Script copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="space-y-6">

      {/* Download em destaque */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Script de disparo automático
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Instale o Tampermonkey no Chrome e depois baixe o script abaixo.
            Feito isso, o disparo é <strong>100% automático</strong> — sem servidor, sem configuração extra.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDownload} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Baixar script (.user.js)
            </Button>
            <Button onClick={handleCopy} variant="outline" size="sm">
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiado!" : "Copiar script"}
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => window.open("https://www.tampermonkey.net/", "_blank")}>
              Instalar Tampermonkey
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Passo a passo */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-5">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-foreground">{step.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Celular */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Usando no celular
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No celular o Tampermonkey não funciona. O disparo é <strong>manual</strong>:{" "}
            clique no prospect → WhatsApp abre com a mensagem pronta → você envia normalmente.
            O status é atualizado no CRM automaticamente.
          </p>
        </CardContent>
      </Card>

      {/* Requisitos */}
      <Card>
        <CardHeader><CardTitle>Requisitos</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Chrome / Edge</Badge>
              O Tampermonkey funciona no Chrome, Edge, Firefox e Opera.
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Número dedicado</Badge>
              Recomendamos usar um chip separado para disparos — reduz risco de bloqueio.
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Sem servidor</Badge>
              Não precisa instalar Node.js, servidor local ou nada extra.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ArrowRight className="h-4 w-4 text-primary" />
            Os controles de fila ficam em <strong>Prospecção → aba "Disparo WhatsApp"</strong>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta aba mostra o guia de instalação. Para disparar, vá para a Prospecção.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
