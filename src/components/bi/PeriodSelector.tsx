import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarRange, ChevronDown, Check } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({
    from: period.from,
    to: period.to,
  });

  const setPreset = (k: PeriodKey) => {
    navigate({
      search: () => ({ period: k }),
      replace: true,
    });
    setMenuOpen(false);
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
    setMenuOpen(false);
  };

  const active = (search.period ?? "mes") as PeriodKey;
  const activeLabel = active === "custom" ? period.rangeLabel : PERIOD_LABEL[active];

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-[60vw] items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/50 sm:max-w-none"
        >
          <CalendarRange className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{activeLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <ul className="flex flex-col py-1" role="menu">
          {ORDER.map((k) => (
            <li key={k}>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={active === k}
                onClick={() => setPreset(k)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition",
                  active === k
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <span>{PERIOD_LABEL[k]}</span>
                {active === k && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            </li>
          ))}
          <li className="my-1 h-px bg-border" />
          <li>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition",
                    active === "custom"
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <CalendarRange className="h-3.5 w-3.5" />
                    {active === "custom" ? period.rangeLabel : "Personalizado"}
                  </span>
                  {active === "custom" && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" side="bottom" className="w-auto p-3">
                <Calendar
                  mode="range"
                  selected={range as never}
                  onSelect={(r) => setRange((r ?? {}) as { from?: Date; to?: Date })}
                  numberOfMonths={1}
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
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
