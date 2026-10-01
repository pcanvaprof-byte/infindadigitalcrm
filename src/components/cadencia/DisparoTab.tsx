import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, QrCode, Zap, ArrowRight } from "lucide-react";

const STEPS = [
  {
    icon: Terminal,
    title: "Inicie o servidor no seu computador",
    description: (
      <>
        Abra a pasta <code className="rounded bg-muted px-1 py-0.5 text-xs">infinda-whatsapp-server</code> no terminal e rode{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">npm install</code> (só na primeira vez) e depois{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">npm start</code>. O servidor vai rodar em{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">localhost:3333</code>.
      </>
    ),
  },
  {
    icon: QrCode,
    title: "Conecte seu WhatsApp",
    description: (
      <>
        Vá em <strong>Prospecção → aba Disparo WhatsApp</strong>, clique em{" "}
        <strong>"Conectar"</strong> e escaneie o QR Code com seu celular. Só precisa fazer isso uma vez — a sessão fica salva.
      </>
    ),
  },
  {
    icon: Zap,
    title: "Selecione e dispare",
    description: (
      <>
        Na aba <strong>Disparo WhatsApp</strong> da Prospecção, selecione os prospects, configure o delay entre mensagens
        (padrão 80–100s) e clique <strong>"Disparar selecionados"</strong>. O CRM envia um por um e atualiza o status
        automaticamente.
      </>
    ),
  },
];

export function DisparoTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Como funciona o disparo</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Requisitos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Node.js</Badge>
              Instale o Node.js 18+ em{" "}
              <a
                href="https://nodejs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:opacity-80"
              >
                nodejs.org
              </a>{" "}
              (versão LTS recomendada).
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">Servidor local</Badge>
              O servidor precisa estar rodando no seu computador para os disparos funcionarem.
            </li>
            <li className="flex flex-wrap items-start gap-2 text-sm text-muted-foreground">
              <Badge variant="outline">WhatsApp</Badge>
              Use um número dedicado para disparos — evita risco de bloqueio no número pessoal.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ArrowRight className="h-4 w-4 text-primary" />
            O disparo em fila fica em{" "}
            <strong>Prospecção → aba "Disparo WhatsApp"</strong>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta aba da Cadência mostra o guia de uso. Os controles de fila, QR Code e seleção de prospects estão na Prospecção.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
