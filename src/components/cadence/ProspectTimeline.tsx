import { useQuery } from "@tanstack/react-query";
import { cadenceKeys, listTouchpoints, type Touchpoint } from "@/lib/cadence/api";
import {
  MessageSquare,
  Phone,
  Mail,
  CalendarClock,
  StickyNote,
} from "lucide-react";

const TIPO_ICON: Record<Touchpoint["tipo"], typeof MessageSquare> = {
  whatsapp: MessageSquare,
  ligacao: Phone,
  email: Mail,
  reuniao: CalendarClock,
  nota: StickyNote,
};

const TIPO_LABEL: Record<Touchpoint["tipo"], string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "Email",
  reuniao: "Reunião",
  nota: "Nota",
};

const RESULTADO_TONE: Record<Touchpoint["resultado"], string> = {
  tentativa: "bg-amber-500/10 text-amber-300",
  enviado: "bg-muted text-muted-foreground",
  sem_resposta: "bg-muted text-muted-foreground",
  respondido: "bg-sky-500/10 text-sky-300",
  interessado: "bg-emerald-500/15 text-emerald-300",
  sem_interesse: "bg-rose-500/10 text-rose-300",
};

export function ProspectTimeline({ prospectId }: { prospectId: string }) {
  const q = useQuery({
    queryKey: cadenceKeys.timeline(prospectId),
    queryFn: () => listTouchpoints(prospectId),
    staleTime: 10_000,
  });

  if (q.isLoading) return <p className="text-xs text-muted-foreground">Carregando histórico…</p>;
  if (q.error) {
    const msg = (q.error as Error).message;
    if (msg.includes("prospect_touchpoints")) {
      return <p className="text-xs text-rose-300">Migration da Fase 6 não foi executada — tabela ausente.</p>;
    }
    return <p className="text-xs text-rose-300">{msg}</p>;
  }
  const rows = q.data ?? [];
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">Sem contatos registrados ainda.</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {rows.map((t) => {
        const Icon = TIPO_ICON[t.tipo];
        const when = new Date(t.enviado_em).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
        });
        return (
          <li key={t.id} className="relative">
            <span className="absolute -left-[21px] top-1 grid h-4 w-4 place-items-center rounded-full bg-accent">
              <Icon className="h-2.5 w-2.5 text-primary-glow" />
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{TIPO_LABEL[t.tipo]}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${RESULTADO_TONE[t.resultado]}`}>
                {t.resultado.replace("_", " ")}
              </span>
              <span className="text-[10px] text-muted-foreground">{when}</span>
            </div>
            {t.mensagem && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{t.mensagem}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}