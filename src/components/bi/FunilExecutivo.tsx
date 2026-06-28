import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown } from "lucide-react";

export interface FunilStage {
  stage: string;
  clientes: number;
}

export function FunilExecutivo({ stages }: { stages: FunilStage[] }) {
  if (!stages?.length) return null;
  const max = Math.max(...stages.map((s) => s.clientes), 1);

  // Identifica o estágio com maior queda absoluta
  let worstIdx = -1;
  let worstDrop = 0;
  stages.forEach((s, i) => {
    if (i === 0) return;
    const prev = stages[i - 1].clientes;
    const drop = prev > 0 ? 1 - s.clientes / prev : 0;
    if (drop > worstDrop) {
      worstDrop = drop;
      worstIdx = i;
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funil executivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {stages.map((s, i) => {
          const widthPct = Math.max(8, Math.round((s.clientes / max) * 100));
          const prev = i > 0 ? stages[i - 1].clientes : null;
          const convPct = prev && prev > 0 ? Math.round((s.clientes / prev) * 100) : null;
          const isWorst = i === worstIdx;
          return (
            <div key={s.stage}>
              {i > 0 && (
                <div className="flex items-center gap-2 pl-2 py-1 text-[11px] text-muted-foreground">
                  <ArrowDown className="h-3 w-3" />
                  <span className={isWorst ? "text-rose-400 font-medium" : ""}>
                    {convPct}% conversão {isWorst ? "· maior queda" : ""}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm text-muted-foreground truncate">{s.stage}</div>
                <div className="flex-1 h-9 rounded-md bg-muted/30 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-700 bg-gradient-to-r ${
                      isWorst ? "from-rose-500/70 to-rose-500/40" : "from-primary to-primary/50"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-sm font-semibold tabular-nums">
                    {s.clientes}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}