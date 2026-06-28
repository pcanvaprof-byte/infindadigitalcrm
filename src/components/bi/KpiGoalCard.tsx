import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: number;
  goal?: number;
  icon?: LucideIcon;
  suffix?: string;
  format?: (n: number) => string;
}

export function KpiGoalCard({ label, value, goal, icon: Icon, suffix, format }: Props) {
  const fmt = format ?? ((n: number) => String(n));
  const pct = goal && goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : null;
  const tone =
    pct === null ? "text-foreground"
      : pct >= 100 ? "text-emerald-400"
      : pct >= 70 ? "text-amber-400"
      : "text-rose-400";
  const barTone =
    pct === null ? "from-primary to-primary/60"
      : pct >= 100 ? "from-emerald-500 to-emerald-400"
      : pct >= 70 ? "from-amber-500 to-amber-400"
      : "from-rose-500 to-rose-400";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            <span className="text-[11px] uppercase tracking-wider">{label}</span>
          </div>
          {pct !== null && <span className={`text-[11px] font-mono ${tone}`}>{pct}%</span>}
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums">{fmt(value)}</span>
          {goal !== undefined && goal > 0 && (
            <span className="text-xs text-muted-foreground">
              / {fmt(goal)} {suffix ?? ""}
            </span>
          )}
        </div>
        {pct !== null && (
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barTone} transition-all duration-700`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}