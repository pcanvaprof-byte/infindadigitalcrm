import { Badge } from "@/components/ui/badge";
import { CAD_STAGE_LABEL, type CadStage } from "@/lib/cadencia/types";

const TONE: Record<CadStage, string> = {
  followup_1: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  followup_2: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  followup_3: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  followup_4: "bg-indigo-500/20 text-indigo-200 border-indigo-500/30",
  followup_5: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  followup_6: "bg-purple-500/20 text-purple-200 border-purple-500/30",
  followup_7: "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-500/30",
  interessado: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  reuniao_agendada: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  proposta_enviada: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  negociacao: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  fechado: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  perdido: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function StageBadge({ stage }: { stage: CadStage }) {
  return (
    <Badge variant="outline" className={TONE[stage]}>{CAD_STAGE_LABEL[stage]}</Badge>
  );
}