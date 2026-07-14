import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { RequireOwnerOrAdmin } from "@/lib/auth/require-role";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LIFECYCLE_LOG_EVENT,
  clearLifecycleLogs,
  listLifecycleLogs,
  type LifecycleLinkEvent,
} from "@/lib/lifecycle/audit-log";

export const Route = createFileRoute("/operacoes/auditoria-lifecycle")({
  ssr: false,
  head: () => ({ meta: [{ title: "Auditoria · Lifecycle Link — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <RequireOwnerOrAdmin>
      <AppShell title="Auditoria" subtitle="Lifecycle Link">
        <AuditPage />
      </AppShell>
      </RequireOwnerOrAdmin>
    </RequireAuth>
  ),
});

const STEP_TONE: Record<string, string> = {
  "open:start": "bg-muted text-muted-foreground",
  "open:match-source_ref": "bg-emerald-500/15 text-emerald-400",
  "open:match-company": "bg-sky-500/15 text-sky-400",
  "open:repair-source_ref": "bg-amber-500/15 text-amber-400",
  "open:created": "bg-violet-500/15 text-violet-400",
  "open:navigate": "bg-muted text-muted-foreground",
  "open:error": "bg-destructive/15 text-destructive",
};

function AuditPage() {
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [sourceRef, setSourceRef] = useState<string>("");

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(LIFECYCLE_LOG_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(LIFECYCLE_LOG_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const all = useMemo(
    () => listLifecycleLogs({ q: q || undefined, source_ref: sourceRef || undefined }),
    [tick, q, sourceRef],
  );

  const refs = useMemo(() => {
    const set = new Map<string, { nome?: string; empresa?: string; count: number }>();
    for (const e of listLifecycleLogs()) {
      const k = e.op_cliente_id;
      if (!k) continue;
      const cur = set.get(k) ?? { nome: e.nome as string, empresa: e.empresa as string, count: 0 };
      cur.count += 1;
      if (!cur.nome && e.nome) cur.nome = e.nome as string;
      if (!cur.empresa && e.empresa) cur.empresa = e.empresa as string;
      set.set(k, cur);
    }
    return [...set.entries()].sort((a, b) => b[1].count - a[1].count);
    // recompute when tick changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const summary = useMemo(() => summarize(all), [all]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-semibold">Como ler</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada linha é uma etapa do fluxo <code>[lifecycle-link]</code> ao abrir uma ficha 360°.
          Para cada cliente o esperado é ver uma sequência <code>open:start</code> →
          (<code>match-source_ref</code> | <code>match-company</code> +{" "}
          <code>repair-source_ref</code> | <code>created</code>) → <code>open:navigate</code>.
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Buscar (texto livre)
            </label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="nome, empresa, lc_id, erro…"
            />
          </div>
          <div className="min-w-[260px]">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Cliente (source_ref)
            </label>
            <Select value={sourceRef || "__all__"} onValueChange={(v) => setSourceRef(v === "__all__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {refs.map(([id, info]) => (
                  <SelectItem key={id} value={id}>
                    {(info.empresa || info.nome || id).slice(0, 50)} · {info.count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setQ(""); setSourceRef(""); }}>
              Limpar filtros
            </Button>
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                if (confirm("Apagar histórico de auditoria deste navegador?")) clearLifecycleLogs();
              }}
            >
              Apagar histórico
            </Button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
          <Kpi label="Eventos" value={summary.total} />
          <Kpi label="Vínculos criados" value={summary.created} tone="text-violet-400" />
          <Kpi label="Vínculos reparados" value={summary.repaired} tone="text-amber-400" />
          <Kpi label="Já vinculados" value={summary.matched} tone="text-emerald-400" />
          <Kpi label="Match por empresa" value={summary.matchedCompany} tone="text-sky-400" />
          <Kpi label="Erros" value={summary.errors} tone="text-destructive" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Quando</th>
                <th className="px-3 py-2 text-left">Etapa</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Ficha 360 (lc_id)</th>
                <th className="px-3 py-2 text-left">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {all.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum evento registrado ainda. Abra uma ficha em{" "}
                    <Link className="underline" to="/operacoes/clientes">
                      /operacoes/clientes
                    </Link>{" "}
                    para gerar logs.
                  </td>
                </tr>
              )}
              {all.map((e, i) => (
                <tr key={i} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {new Date(e.ts).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${STEP_TONE[e.step] ?? "bg-muted text-muted-foreground"}`}>
                      {e.step}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{e.empresa || e.nome || "—"}</div>
                    <div className="text-[11px] text-muted-foreground break-all">{e.op_cliente_id ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {e.lc_id ? (
                      <Link
                        className="underline"
                        to="/operacoes/clientes/$id"
                        params={{ id: String(e.lc_id) }}
                      >
                        {String(e.lc_id).slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    <Details ev={e} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Details({ ev }: { ev: LifecycleLinkEvent }) {
  const omit = new Set(["ts", "step", "op_cliente_id", "nome", "empresa", "lc_id"]);
  const rest: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ev)) if (!omit.has(k)) rest[k] = v;
  if (Object.keys(rest).length === 0) return <span>—</span>;
  return <code className="whitespace-pre-wrap break-all">{JSON.stringify(rest)}</code>;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone ?? ""}`}>{value}</p>
    </Card>
  );
}

function summarize(list: LifecycleLinkEvent[]) {
  let created = 0,
    repaired = 0,
    matched = 0,
    matchedCompany = 0,
    errors = 0;
  for (const e of list) {
    if (e.step === "open:created") created++;
    else if (e.step === "open:repair-source_ref") repaired++;
    else if (e.step === "open:match-source_ref") matched++;
    else if (e.step === "open:match-company") matchedCompany++;
    else if (e.step === "open:error") errors++;
  }
  return { total: list.length, created, repaired, matched, matchedCompany, errors };
}