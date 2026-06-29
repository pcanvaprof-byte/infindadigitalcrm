import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERIOD_KEYS,
  PERIOD_LABEL,
  type PeriodKey,
  type ResolvedPeriod,
} from "@/lib/bi/period";
import { localDateKey } from "@/lib/bi/tz";

const ORDER: PeriodKey[] = ["hoje", "semana", "mes", "trimestre", "30d", "90d"];

export function PeriodSelector({ period }: { period: ResolvedPeriod }) {
  const navigate = useNavigate({ from: "/bi" });
  const search = useSearch({ from: "/bi" }) as {
    period?: PeriodKey;
    from?: string;
    to?: string;
  };
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: period.from,
    to: period.to,
  });

  const setPreset = (k: PeriodKey) => {
    navigate({
      search: () => ({ period: k }),
      replace: true,
    });
  };

  const applyCustom = () => {
    if (!range.from || !range.to) return;
    navigate({
      search: () => ({
        period: "custom" as const,
        from: localDateKey(range.from!),
        to: localDateKey(range.to!),
      }),
      replace: true,
    });
    setOpen(false);
  };

  const active = (search.period ?? "mes") as PeriodKey;

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card/60 p-1">
      {ORDER.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => setPreset(k)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition",
            active === k
              ? "bg-primary/15 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
          )}
        >
          {PERIOD_LABEL[k]}
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition",
              active === "custom"
                ? "bg-primary/15 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
            )}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {active === "custom" ? period.rangeLabel : "Personalizado"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          <Calendar
            mode="range"
            selected={range as never}
            onSelect={(r) => setRange((r ?? {}) as { from?: Date; to?: Date })}
            numberOfMonths={2}
            initialFocus
            className={cn("pointer-events-auto")}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {range.from && range.to
                ? `${range.from.toLocaleDateString("pt-BR")} → ${range.to.toLocaleDateString("pt-BR")}`
                : "Selecione um intervalo"}
            </span>
            <Button
              size="sm"
              onClick={applyCustom}
              disabled={!range.from || !range.to}
            >
              Aplicar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
