import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  auditDispatches,
  listDispatchRows,
  type DispatchAuditResult,
  type DispatchBucket,
  type DispatchRow,
} from "@/lib/bi/dispatches.functions";

export const Route = createFileRoute("/bi/disparos")({
  component: DispatchesAuditPage,
  head: () => ({
    meta: [{ title: "Auditoria de Disparos — INFINDA BI" }],
  }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-red-600">Erro: {String(error)}</div>
  ),
  notFoundComponent: () => <div className="p-6">Não encontrado.</div>,
});

function DispatchesAuditPage() {
  const router = useRouter();
  const audit = useServerFn(auditDispatches);
  const listRows = useServerFn(listDispatchRows);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const q = useQuery({
    queryKey: ["bi", "dispatches-audit", from, to],
    queryFn: () => audit({ data: from && to ? { from, to } : {} }),
    staleTime: 30_000,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Auditoria de Disparos</h1>
        <div className="flex gap-2">
        <button
          className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm"
          onClick={() => router.invalidate()}
        >
          Recalcular
        </button>
        <button
          className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm disabled:opacity-50"
          disabled={exporting}
          onClick={async () => {
            const range = computeExportRange(from, to);
            setExporting(true);
            try {
              const rows = await listRows({ data: range });
              downloadCsv(rows, `disparos_${range.from.slice(0, 10)}_${range.to.slice(0, 10)}.csv`);
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Gerando…" : "Exportar CSV"}
        </button>
        </div>
      </div>
      <p className="text-sm text-slate-500">
        Contagem calculada no backend (server function). Fontes:{" "}
        <code>cad_messages</code> (Cadência) + <code>prospect_touchpoints</code>{" "}
        outbound (Prospecção). Fuso fixo America/Sao_Paulo.
      </p>

      <div className="flex flex-wrap gap-2 items-end border rounded p-3 bg-slate-50">
        <label className="text-xs flex flex-col">
          De (data + hora)
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-xs flex flex-col">
          Até (data + hora)
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
        <PresetButtons onPick={(a, b) => { setFrom(a); setTo(b); }} />
        {(from || to) && (
          <button
            className="px-2 py-1 text-xs underline"
            onClick={() => { setFrom(""); setTo(""); }}
          >
            limpar
          </button>
        )}
      </div>

      {q.isLoading && <div>Carregando…</div>}
      {q.error && <div className="text-red-600">Falha: {String(q.error)}</div>}
      {q.data && <ResultView data={q.data} />}
    </div>
  );
}

function ResultView({ data }: { data: DispatchAuditResult }) {
  return (
    <div className="space-y-4">
      <BucketCard title="Hoje" b={data.today} />
      <BucketCard title="Ontem" b={data.yesterday} />
      <BucketCard title="Últimos 7 dias" b={data.last7d} />
      <DailySeries series={data.daily_series} />
      {data.custom && <BucketCard title="Período customizado" b={data.custom} />}
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">JSON bruto</summary>
        <pre className="bg-slate-900 text-slate-100 p-3 rounded overflow-auto text-xs">
{JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function BucketCard({ title, b }: { title: string; b: DispatchBucket }) {
  return (
    <div className="border rounded p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-slate-500">
          {b.range.from.slice(0, 16)} → {b.range.to.slice(11, 16)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Total" value={b.total} highlight />
        <Stat label="Cadência" value={b.cadencia} />
        <Stat label="Prospecção" value={b.prospeccao} />
        <Stat label="WhatsApp" value={b.por_tipo.whatsapp ?? 0} />
        <Stat label="Ligação" value={b.por_tipo.ligacao ?? 0} />
        <Stat label="E-mail" value={b.por_tipo.email ?? 0} />
        <Stat label="Reunião" value={b.por_tipo.reuniao ?? 0} />
      </div>
      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <BreakdownTable
          title="Por cadência (stage do lead)"
          rows={b.por_cadencia.map((r) => ({ label: r.stage, value: r.total }))}
        />
        <BreakdownTable
          title="Por campanha / origem"
          rows={b.por_campanha.map((r) => ({ label: r.campanha, value: r.total }))}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded px-3 py-2 ${highlight ? "bg-slate-900 text-white" : "bg-slate-100"}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function BreakdownTable({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  if (!rows.length) return (
    <div className="text-xs text-slate-500 border rounded p-3">
      <div className="font-medium text-slate-700 mb-1">{title}</div>
      Nenhum dado no período.
    </div>
  );
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="border rounded p-3">
      <div className="font-medium text-slate-700 mb-2 text-sm">{title}</div>
      <ul className="space-y-1">
        {rows.slice(0, 10).map((r) => (
          <li key={r.label} className="text-xs">
            <div className="flex justify-between">
              <span className="truncate max-w-[60%]" title={r.label}>{r.label}</span>
              <span className="tabular-nums font-semibold">{r.value}</span>
            </div>
            <div className="h-1.5 rounded bg-slate-100 overflow-hidden">
              <div className="h-full bg-slate-800" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DailySeries({ series }: { series: DispatchAuditResult["daily_series"] }) {
  const max = Math.max(...series.map((s) => s.total), 1);
  return (
    <div className="border rounded p-4">
      <h2 className="font-semibold mb-3">Série diária (últimos 7 dias)</h2>
      <div className="grid grid-cols-7 gap-2">
        {series.map((s) => (
          <div key={s.date} className="text-center">
            <div className="h-24 flex items-end justify-center gap-0.5">
              <div
                className="w-3 bg-blue-500 rounded-t"
                style={{ height: `${(s.cadencia / max) * 100}%` }}
                title={`Cadência: ${s.cadencia}`}
              />
              <div
                className="w-3 bg-emerald-500 rounded-t"
                style={{ height: `${(s.prospeccao / max) * 100}%` }}
                title={`Prospecção: ${s.prospeccao}`}
              />
            </div>
            <div className="text-[10px] mt-1 text-slate-500">{s.date.slice(5)}</div>
            <div className="text-xs font-semibold tabular-nums">{s.total}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 text-xs text-slate-500 mt-2">
        <span><span className="inline-block w-2 h-2 bg-blue-500 mr-1" />Cadência</span>
        <span><span className="inline-block w-2 h-2 bg-emerald-500 mr-1" />Prospecção</span>
      </div>
    </div>
  );
}

function PresetButtons({ onPick }: { onPick: (from: string, to: string) => void }) {
  function fmt(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const presets: Array<{ label: string; calc: () => [Date, Date] }> = [
    { label: "Hoje", calc: () => { const a = new Date(); a.setHours(0,0,0,0); const b = new Date(); b.setHours(23,59,59,999); return [a,b]; } },
    { label: "Ontem", calc: () => { const a = new Date(); a.setDate(a.getDate()-1); a.setHours(0,0,0,0); const b = new Date(a); b.setHours(23,59,59,999); return [a,b]; } },
    { label: "7d", calc: () => { const b = new Date(); b.setHours(23,59,59,999); const a = new Date(); a.setDate(a.getDate()-6); a.setHours(0,0,0,0); return [a,b]; } },
    { label: "30d", calc: () => { const b = new Date(); b.setHours(23,59,59,999); const a = new Date(); a.setDate(a.getDate()-29); a.setHours(0,0,0,0); return [a,b]; } },
  ];
  return (
    <div className="flex gap-1 items-center">
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          className="px-2 py-1 text-xs bg-white border rounded hover:bg-slate-100"
          onClick={() => { const [a, b] = p.calc(); onPick(fmt(a), fmt(b)); }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function computeExportRange(from: string, to: string): { from: string; to: string } {
  if (from && to) return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
  // default: hoje
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(23, 59, 59, 999);
  return { from: a.toISOString(), to: b.toISOString() };
}

function downloadCsv(rows: DispatchRow[], filename: string) {
  const headers = ["ts", "origem", "tipo", "empresa", "stage", "campanha", "id"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.ts, r.origem, r.tipo, r.empresa, r.stage, r.campanha, r.id].map(escape).join(","));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}