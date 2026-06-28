import { useQuery } from "@tanstack/react-query";
import { dashboardKeys, fetchFilterOptions, type DashboardFilters, type Preset } from "@/lib/dashboard/api-v7";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "hoje",      label: "Hoje" },
  { value: "ontem",     label: "Ontem" },
  { value: "semana",    label: "Semana" },
  { value: "mes",       label: "Mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano",       label: "Ano" },
];

export function FiltersBar({
  filters, onChange,
}: {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
}) {
  const optsQ = useQuery({
    queryKey: dashboardKeys.options,
    queryFn: fetchFilterOptions,
    staleTime: 5 * 60_000,
  });
  const vendedores = optsQ.data?.vendedores ?? [];
  const preset = filters.preset ?? "mes";
  const owner  = filters.owner_name ?? "__all__";
  const hasFilters = Boolean(filters.owner_name) || preset !== "mes";

  return (
    <div className="surface-card mb-4 flex flex-wrap items-center gap-2 p-3">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-semibold text-muted-foreground">Filtros</span>

      <div className="ml-2">
        <Select value={preset} onValueChange={(v) => onChange({ ...filters, preset: v as Preset, from: undefined, to: undefined })}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Select
          value={owner}
          onValueChange={(v) => onChange({ ...filters, owner_name: v === "__all__" ? null : v })}
        >
          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue placeholder="Vendedor / Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos vendedores</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v.owner_name} value={v.owner_name}>{v.owner_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="ml-auto h-8 text-xs" onClick={() => onChange({ preset: "mes", owner_name: null })}>
          <X className="mr-1 h-3 w-3" /> Limpar
        </Button>
      )}
    </div>
  );
}