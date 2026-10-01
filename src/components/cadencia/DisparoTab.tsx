import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, MessageSquare, Zap, X } from "lucide-react";

const SCRIPT_CONTENT = `// ==UserScript==
// @name         Auto Enviar WhatsApp MEI
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Aperta o botão de enviar e fecha a aba sozinho
// @author       INFINDA
// @match        https://web.whatsapp.com/send?*
// @grant        window.close
// ==/UserScript==

(function() {
    'use strict';

    const disparar = setInterval(() => {
        let btnEnviar = document.querySelector('span[data-icon="send"]') || document.querySelector('button[aria-label="Enviar"]');
        
        if (btnEnviar) {
            btnEnviar.click();
            console.log("Mensagem enviada! Fechando em 3 segundos...");
            clearInterval(disparar);
            
            setTimeout(() => {
                window.close();
            }, 3000);
        }
    }, 1000);
})();`;

const STEPS = [
  {
    icon: MessageSquare,
    title: 'Clique em "Enviar via WhatsApp" no card do lead',
    description: "O WhatsApp Web abre em uma nova aba com a mensagem já preenchida.",
  },
  {
    icon: Zap,
    title: "O script detecta o botão de enviar e clica automaticamente",
    description: "Nenhuma ação sua necessária — o Tampermonkey cuida do resto.",
  },
  {
    icon: X,
    title: "A aba fecha sozinha após 3 segundos",
    description: "Tempo suficiente para garantir que a mensagem foi entregue ao servidor.",
  },
];

export function DisparoTab() {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SCRIPT_CONTENT);
      setCopied(true);
      toast.success("Script copiado para o clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o script manualmente.");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([SCRIPT_CONTENT], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "infinda-auto-enviar-whatsapp.user.js";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Download iniciado!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Como funciona</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium text-foreground">{step.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instalar o script</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Instale a extensão{" "}
            <a
              href="https://www.tampermonkey.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:opacity-80"
            >
              Tampermonkey
              <ExternalLink className="h-3 w-3" />
            </a>{" "}
            no seu navegador, depois copie ou baixe o script abaixo e adicione-o ao Tampermonkey.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopy} variant="outline" size="sm">
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiado!" : "Copiar script"}
            </Button>
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Baixar .user.js
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
            <code>{SCRIPT_CONTENT}</code>
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Observações importantes</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Desktop</Badge>
              O script funciona apenas no WhatsApp Web (desktop/browser), não no app mobile.
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Mobile</Badge>
              No celular o WhatsApp abre normalmente e você envia manualmente.
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Requisito</Badge>
              Requer Tampermonkey instalado e ativo no navegador.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
