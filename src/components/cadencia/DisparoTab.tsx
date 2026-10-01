import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Terminal, QrCode, Zap, ArrowRight, Download, Smartphone, Monitor } from "lucide-react";
import { toast } from "sonner";

// Conteúdo do .bat gerado dinamicamente para download
const BAT_CONTENT = `@echo off
title INFINDA - Servidor de Disparo WhatsApp
color 0A

echo.
echo  ==========================================
echo   INFINDA - Servidor de Disparo WhatsApp
echo  ==========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERRO] Node.js nao encontrado!
    echo.
    echo  Por favor, instale o Node.js em:
    echo  https://nodejs.org  (versao LTS)
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules" (
    echo  Instalando dependencias pela primeira vez...
    echo  Aguarde, isso pode levar alguns minutos.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERRO] Falha ao instalar dependencias.
        pause
        exit /b 1
    )
    echo  Dependencias instaladas!
    echo.
)

echo  Iniciando servidor...
start /B node server.js

timeout /t 3 /nobreak >nul

echo  Abrindo INFINDA no navegador...
start https://app.lovable.app/projects/

echo.
echo  ==========================================
echo   Servidor rodando em http://localhost:3333
echo   Va em Prospeccao - aba Disparo WhatsApp
echo   e escaneie o QR Code com seu celular.
echo  ==========================================
echo.
echo  MANTENHA ESTA JANELA ABERTA enquanto disparar.
echo  Para encerrar, feche esta janela.
echo.

:loop
timeout /t 60 /nobreak >nul
goto loop`;

const STEPS = [
  {
    icon: Monitor,
    title: "Baixe o servidor e dê dois cliques no .bat",
    description: (
      <>
        Baixe a pasta do servidor abaixo, extraia em qualquer lugar do seu PC e dê{" "}
        <strong>dois cliques</strong> no arquivo <code className="rounded bg-muted px-1 py-0.5 text-xs">infinda-disparar.bat</code>.
        O servidor sobe automaticamente e o INFINDA abre no navegador.
      </>
    ),
  },
  {
    icon: QrCode,
    title: "Escaneie o QR Code (só na primeira vez)",
    description: (
      <>
        Vá em <strong>Prospecção → aba Disparo WhatsApp</strong>, clique em{" "}
        <strong>"Conectar"</strong> e escaneie o QR Code com seu celular. A sessão fica salva — da próxima vez conecta sozinho.
      </>
    ),
  },
  {
    icon: Zap,
    title: "Selecione os prospects e dispare",
    description: (
      <>
        Selecione os prospects, configure o delay (padrão 80–100s entre mensagens) e clique{" "}
        <strong>"Disparar selecionados"</strong>. O CRM envia um por um e atualiza o status automaticamente.
        Feche a aba para pausar o disparo.
      </>
    ),
  },
];

function downloadBat() {
  const blob = new Blob([BAT_CONTENT], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "infinda-disparar.bat";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast.success("Download iniciado! Extraia e dê dois cliques no .bat");
}

export function DisparoTab() {
  return (
    <div className="space-y-6">

      {/* Card de download em destaque */}
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Baixar servidor de disparo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Baixe o servidor, extraia a pasta e dê dois cliques no <code className="rounded bg-muted px-1 py-0.5 text-xs">infinda-disparar.bat</code>.
            Só precisa do <strong>Node.js instalado</strong> — o resto é automático.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadBat} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Baixar infinda-disparar.bat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://nodejs.org", "_blank")}
            >
              Baixar Node.js (se não tiver)
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
            No celular o servidor local não roda. O disparo funciona de forma <strong>manual</strong>:{" "}
            clique no prospect → o WhatsApp abre com a mensagem pronta → envie normalmente.
            O status é atualizado no CRM após o envio.
          </p>
        </CardContent>
      </Card>

      {/* Requisitos */}
      <Card>
        <CardHeader>
          <CardTitle>Requisitos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Node.js 18+</Badge>
              Instale em <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">nodejs.org</a> (versão LTS). Só precisa instalar uma vez.
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Windows</Badge>
              O arquivo .bat funciona no Windows. Mac/Linux: rode <code className="rounded bg-muted px-1 py-0.5 text-xs">npm start</code> na pasta do servidor.
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Número dedicado</Badge>
              Recomendamos usar um chip separado para disparos — reduz risco de bloqueio.
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
            Esta aba mostra o guia de instalação. Após iniciar o servidor, vá para a Prospecção para disparar.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
