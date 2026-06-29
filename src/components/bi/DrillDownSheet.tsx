import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, X, Copy, Download, FileSpreadsheet } from "lucide-react";
import { utils, writeFile } from "xlsx";
import { toast } from "sonner";
import type { ResolvedPeriod } from "@/lib/bi/period";
import {
  fetchDrillDown,
  type DrillFrame as _Frame,
  type DrillColumn,
  type DrillResult,
  type DrillRow,
} from "@/lib/bi/drilldown";
import type { DrillFrame } from "@/hooks/useDrillDown";

// _Frame is intentionally re-exported via drilldown — silence unused.
void (0 as unknown as _Frame);

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function fmtCell(value: unknown, format?: DrillColumn["format"]) {
  if (value == null || value === "") return "—";
  switch (format) {
    case "currency":
      return fmtBRL(Number(value));
    case "date": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    case "number":
      return Number(value).toLocaleString("pt-BR");
    default:
      return String(value);
  }
}

function QuickInsights({
  result,
  empty,
}: {
  result: DrillResult | undefined;
  empty: boolean;
}) {
  const stats = useMemo(() => {
    if (!result || empty) return null;
    const valued = result.rows
      .map((r) => Number(r._value ?? 0))
      .filter((n) => Number.isFinite(n) && n !== 0);
    if (valued.length === 0) {
      return { count: result.rows.length, sum: 0, avg: 0, max: 0, min: 0 };
    }
    const sum = valued.reduce((a, b) => a + b, 0);
    return {
      count: result.rows.length,
      sum,
      avg: sum / valued.length,
      max: Math.max(...valued),
      min: Math.min(...valued),
    };
  }, [result, empty]);

  if (!stats) return null;
  const label = result?.valueLabel ?? "Valor";
  const isCurrency = label === "Receita" || label === "Valor";
  const fmt = isCurrency ? fmtBRL : (n: number) => Math.round(n).toLocaleString("pt-BR");

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <Stat label="Registros" value={String(stats.count)} />
      {stats.sum > 0 && <Stat label={`${label} (total)`} value={fmt(stats.sum)} />}
      {stats.avg > 0 && <Stat label={`${label} médio`} value={fmt(stats.avg)} />}
      {stats.max > 0 && <Stat label={`${label} máx.`} value={fmt(stats.max)} />}
      {stats.min > 0 && <Stat label={`${label} mín.`} value={fmt(stats.min)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function rowsForExport(result: DrillResult): Array<Record<string, unknown>> {
  return result.rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of result.columns) {
      const v = r[c.key];
      out[c.label] =
        c.format === "date" && v ? new Date(String(v)).toISOString() : v ?? "";
    }
    return out;
  });
}

function exportCSV(filename: string, result: DrillResult) {
  const rows = rowsForExport(result);
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportXLSX(filename: string, result: DrillResult) {
  const rows = rowsForExport(result);
  const wb = utils.book_new();
  const ws = utils.json_to_sheet(rows);
  utils.book_append_sheet(wb, ws, "Drill");
  writeFile(wb, `${filename}.xlsx`);
}

async function copyTable(result: DrillResult) {
  const rows = rowsForExport(result);
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const tsv = [
    headers.join("\t"),
    ...rows.map((r) => headers.map((h) => String(r[h] ?? "")).join("\t")),
  ].join("\n");
  try {
    await navigator.clipboard.writeText(tsv);
    toast.success("Tabela copiada para a área de transferência");
  } catch {
    toast.error("Não foi possível copiar");
  }
}

interface Props {
  open: boolean;
  stack: DrillFrame[];
  period: ResolvedPeriod;
  areaLabel: string;
  onClose: () => void;
  onBack: () => void;
  onPush: (f: DrillFrame) => void;
}

export function DrillDownSheet({
  open,
  stack,
  period,
  areaLabel,
  onClose,
  onBack,
  onPush,
}: Props) {
  const top = stack[stack.length - 1];

  const q = useQuery<DrillResult>({
    queryKey: [
      "drill",
      top?.kind,
      top?.params,
      period.key,
      period.from.toISOString(),
      period.to.toISOString(),
    ],
    queryFn: () => fetchDrillDown(top!.kind, top?.params, period),
    enabled: open && !!top,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const data = q.data;
  const isEmpty = !q.isLoading && (!data || data.rows.length === 0);

  const handleRowClick = (row: DrillRow) => {
    if (!row._drillTo) return;
    onPush({
      id: row.id,
      kind: row._drillTo.kind,
      title: row._drillTo.title,
      params: row._drillTo.params,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl p-0 flex flex-col"
      >
        {top && (
          <>
            <SheetHeader className="px-6 pt-6 pb-3 border-b border-border space-y-2">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>BI</span>
                <span>›</span>
                <span>{areaLabel}</span>
                {stack.map((f, i) => (
                  <span key={f.id} className="flex items-center gap-2">
                    <span>›</span>
                    <span className={i === stack.length - 1 ? "text-foreground" : ""}>
                      {f.crumb ?? f.title}
                    </span>
                  </span>
                ))}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-tight truncate">
                    {top.title}
                  </SheetTitle>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{period.label}</Badge>
                    <span>{period.rangeLabel}</span>
                    {top.subtitle && <span>· {top.subtitle}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {stack.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={onBack}>
                      <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              {q.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              )}

              {!q.isLoading && data && <QuickInsights result={data} empty={isEmpty} />}

              {isEmpty && !q.isLoading && (
                <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum registro encontrado para o período selecionado.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tente trocar o filtro de período acima.
                  </p>
                </div>
              )}

              {!q.isLoading && data && data.rows.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                       style={{ gridTemplateColumns: data.columns.map(() => "1fr").join(" ") }}>
                    {data.columns.map((c) => (
                      <div key={c.key}>{c.label}</div>
                    ))}
                  </div>
                  <div className="divide-y divide-border">
                    {data.rows.slice(0, 200).map((r) => {
                      const clickable = !!r._drillTo;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleRowClick(r)}
                          disabled={!clickable}
                          className={`grid w-full text-left px-3 py-2 text-sm transition ${
                            clickable
                              ? "hover:bg-accent/30 cursor-pointer"
                              : "cursor-default"
                          }`}
                          style={{ gridTemplateColumns: data.columns.map(() => "1fr").join(" ") }}
                        >
                          {data.columns.map((c) => (
                            <div key={c.key} className="truncate">
                              {c.format === "badge" ? (
                                <Badge variant="secondary" className="font-normal">
                                  {fmtCell(r[c.key], c.format)}
                                </Badge>
                              ) : (
                                <span className="tabular-nums">
                                  {fmtCell(r[c.key], c.format)}
                                </span>
                              )}
                            </div>
                          ))}
                        </button>
                      );
                    })}
                  </div>
                  {data.rows.length > 200 && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground bg-muted/20">
                      Mostrando 200 de {data.rows.length} registros — exporte para ver tudo.
                    </p>
                  )}
                </div>
              )}
            </div>

            {!isEmpty && data && (
              <div className="border-t border-border px-6 py-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {data.rows.length} registros
                </span>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => copyTable(data)}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportCSV(`bi-${top.kind}`, data)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportXLSX(`bi-${top.kind}`, data)}>
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> XLSX
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
