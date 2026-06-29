import { Card, CardContent } from "@/components/ui/card";
import { Target, FileSignature, CalendarClock, PhoneCall, Building2, Send, ArrowDown } from "lucide-react";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

interface Props {
  meta: number;
  realizado: number;
  recorrencia?: number;
  ticket: number;
  /** % conversão lead→contrato (0–100). Fallback 5 */
  taxaConversao?: number | null;
  /** % conversão reunião→contrato (0–100). Fallback 25 */
  taxaReuniao?: number | null;
  /** % conversão contato→reunião (0–100). Fallback 20 */
  taxaContato?: number | null;
}

/**
 * Cascata operacional: a partir do gap restante calcula, passo a passo,
 * contratos → reuniões → contatos → empresas → disparos necessários.
 */
export function CascataOperacional({
  meta, realizado, recorrencia = 0, ticket, taxaConversao, taxaReuniao, taxaContato,
}: Props) {
  const gap = Math.max(0, meta - recorrencia - Math.max(0, realizado));
  const convPct = taxaConversao && taxaConversao > 0 ? taxaConversao : 5;
  const reuPct = taxaReuniao && taxaReuniao > 0 ? taxaReuniao : 25;
  const contPct = taxaContato && taxaContato > 0 ? taxaContato : 20;

  const contratos = ticket > 0 ? Math.ceil(gap / ticket) : 0;
  const reunioes = contratos > 0 ? Math.ceil((contratos * 100) / reuPct) : 0;
  // contatos = reuniões / taxaContato (contato→reunião)
  const contatos = reunioes > 0 ? Math.ceil((reunioes * 100) / contPct) : 0;
  // empresas necessárias = leads (ainda usa conversão histórica lead→contrato)
  const empresas = contratos > 0 ? Math.ceil((contratos * 100) / convPct) : 0;
  // disparos ≈ 1.4× empresas (overhead de tentativas)
  const disparos = Math.ceil(empresas * 1.4);

  const steps = [
    { icon: Target,         label: "Meta restante",         value: fmtBRL(gap),       tone: "text-rose-400" },
    { icon: FileSignature,  label: "Contratos necessários", value: String(contratos), tone: "text-amber-400" },
    { icon: CalendarClock,  label: "Reuniões necessárias",  value: String(reunioes),  tone: "text-violet-400" },
    { icon: PhoneCall,      label: "Contatos necessários",  value: String(contatos),  tone: "text-sky-400" },
    { icon: Building2,      label: "Empresas necessárias",  value: String(empresas),  tone: "text-emerald-400" },
    { icon: Send,           label: "Disparos necessários",  value: String(disparos),  tone: "text-primary" },
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
          <Target className="h-3.5 w-3.5" /> Cascata operacional
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Conversão {convPct}% · Reunião {reuPct}% · Contato {contPct}% · Ticket {fmtBRL(ticket || 0)}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label}>
                <div className="rounded-xl border border-border bg-card/60 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg border border-border bg-background/60 grid place-items-center text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  </div>
                  <span className={`text-xl font-semibold tabular-nums ${s.tone}`}>{s.value}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="my-0.5 flex justify-center text-muted-foreground/40">
                    <ArrowDown className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}