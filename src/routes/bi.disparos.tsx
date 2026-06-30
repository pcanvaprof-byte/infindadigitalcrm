import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { auditDispatches, type DispatchAuditResult, type DispatchBucket } from "@/lib/bi/dispatches.functions";

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
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const q = useQuery({
    queryKey: ["bi", "dispatches-audit", from, to],
    queryFn: () => audit({ data: from && to ? { from, to } : {} }),
    staleTime: 30_000,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Auditoria de Disparos</h1>
        <button
          className="px-3 py-1.5 rounded bg-slate-800 text-white text-sm"
          onClick={() => router.invalidate()}
        >
          Recalcular
        </button>
      </div>
      <p className="text-sm text-slate-500">
        Contagem calculada no backend (server function autenticada). RLS aplica
        a organização do solicitante. Fontes: <code>cad_messages</code> +{" "}
        <code>prospect_touchpoints</code> (outbound).
      </p>

      <div className="flex flex-wrap gap-2 items-end border rounded p-3 bg-slate-50">
        <label className="text-xs flex flex-col">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="text-xs flex flex-col">
          Até
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
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
      <BucketCard title="Semana (seg → hoje)" b={data.week} />
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