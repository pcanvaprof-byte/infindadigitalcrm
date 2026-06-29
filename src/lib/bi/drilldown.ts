import { supabase as sb } from "@/integrations/supabase/client";
import type { ResolvedPeriod } from "./period";

export type DrillKind =
  | "contracts"
  | "contracts-status"
  | "leads-stage"
  | "proposals"
  | "dispatches"
  | "touchpoints"
  | "touchpoints-channel"
  | "churn-risk"
  | "prospects-new"
  | "empresas";

export interface DrillColumn {
  key: string;
  label: string;
  format?: "text" | "currency" | "date" | "number" | "badge";
  width?: string;
}

export interface DrillRow {
  id: string;
  /** Coluna numérica usada para insights agregados (sum/avg/max/min). */
  _value?: number;
  /** Identificador para drill encadeado (cliente). */
  _drillTo?: { kind: DrillKind; title: string; params?: Record<string, unknown> };
  [k: string]: unknown;
}

export interface DrillResult {
  columns: DrillColumn[];
  rows: DrillRow[];
  valueLabel?: string;
}

const fmtDateISO = (d: Date) => d.toISOString();

async function safeSelect<T = Record<string, unknown>>(
  table: string,
  columns: string,
  filter?: (q: unknown) => unknown,
): Promise<T[]> {
  try {
    let q = sb.from(table as never).select(columns);
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q;
    if (error) return [];
    return (data ?? []) as unknown as T[];
  } catch {
    return [];
  }
}

function dateBetween(col: string, period: ResolvedPeriod) {
  return (q: unknown) =>
    (q as { gte: (c: string, v: string) => { lte: (c: string, v: string) => unknown } })
      .gte(col, fmtDateISO(period.from))
      .lte(col, fmtDateISO(period.to));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ============================================================
// CONTRACTS
// ============================================================
async function fetchContracts(
  period: ResolvedPeriod,
  params: { status?: string } = {},
): Promise<DrillResult> {
  let rows = await safeSelect<Record<string, unknown>>(
    "contracts",
    "id, empresa, cliente, company_name, monthly_value, contract_value, value, status, signed_at",
    dateBetween("signed_at", period),
  );
  if (rows.length === 0) {
    rows = await safeSelect<Record<string, unknown>>(
      "op_contracts",
      "id, empresa, cliente, company_name, monthly_value, contract_value, status, signed_at",
      dateBetween("signed_at", period),
    );
  }
  const filtered = params.status
    ? rows.filter(
        (r) => String(r.status ?? "").toLowerCase() === params.status?.toLowerCase(),
      )
    : rows;

  return {
    valueLabel: "Receita",
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "valor", label: "Valor", format: "currency" },
      { key: "status", label: "Status", format: "badge" },
      { key: "signed_at", label: "Assinado em", format: "date" },
    ],
    rows: filtered.map((r, i) => {
      const valor = num(r.contract_value ?? r.value ?? r.monthly_value);
      const empresa =
        String(r.empresa ?? r.cliente ?? r.company_name ?? "—") || "—";
      return {
        id: String(r.id ?? `c-${i}`),
        _value: valor,
        empresa,
        valor,
        status: r.status ?? "—",
        signed_at: r.signed_at ?? null,
        _drillTo: {
          kind: "touchpoints" as const,
          title: `Histórico — ${empresa}`,
          params: { empresa },
        },
      };
    }),
  };
}

// ============================================================
// LEADS por etapa (cad_leads)
// ============================================================
async function fetchLeadsStage(
  period: ResolvedPeriod,
  params: { stage?: string } = {},
): Promise<DrillResult> {
  const rows = await safeSelect<Record<string, unknown>>(
    "cad_leads",
    "id, empresa, cnpj, responsavel, whatsapp, status, estagio, stage, updated_at",
    dateBetween("updated_at", period),
  );
  const filtered = params.stage
    ? rows.filter((r) => {
        const s = String(r.estagio ?? r.stage ?? r.status ?? "").toLowerCase();
        return s.includes(String(params.stage).toLowerCase());
      })
    : rows;
  return {
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "responsavel", label: "Responsável" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "stage", label: "Etapa", format: "badge" },
      { key: "updated_at", label: "Atualizado", format: "date" },
    ],
    rows: filtered.map((r, i) => ({
      id: String(r.id ?? `l-${i}`),
      empresa: r.empresa ?? "—",
      responsavel: r.responsavel ?? "—",
      whatsapp: r.whatsapp ?? "—",
      stage: r.estagio ?? r.stage ?? r.status ?? "—",
      updated_at: r.updated_at ?? null,
    })),
  };
}

// ============================================================
// PROPOSALS
// ============================================================
async function fetchProposals(period: ResolvedPeriod): Promise<DrillResult> {
  let rows = await safeSelect<Record<string, unknown>>(
    "proposals",
    "id, empresa, cliente, valor, total, status, created_at",
    dateBetween("created_at", period),
  );
  if (rows.length === 0) {
    rows = await safeSelect<Record<string, unknown>>(
      "op_proposals",
      "id, empresa, cliente, valor, total, status, created_at",
      dateBetween("created_at", period),
    );
  }
  return {
    valueLabel: "Valor",
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "valor", label: "Valor", format: "currency" },
      { key: "status", label: "Status", format: "badge" },
      { key: "created_at", label: "Criada", format: "date" },
    ],
    rows: rows.map((r, i) => {
      const valor = num(r.valor ?? r.total);
      return {
        id: String(r.id ?? `p-${i}`),
        _value: valor,
        empresa: r.empresa ?? r.cliente ?? "—",
        valor,
        status: r.status ?? "—",
        created_at: r.created_at ?? null,
      };
    }),
  };
}

// ============================================================
// DISPATCHES (cad_messages)
// ============================================================
async function fetchDispatches(period: ResolvedPeriod): Promise<DrillResult> {
  const rows = await safeSelect<Record<string, unknown>>(
    "cad_messages",
    "id, lead_id, empresa, canal, status, created_at",
    dateBetween("created_at", period),
  );
  return {
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "canal", label: "Canal", format: "badge" },
      { key: "status", label: "Status", format: "badge" },
      { key: "created_at", label: "Enviado", format: "date" },
    ],
    rows: rows.map((r, i) => ({
      id: String(r.id ?? `m-${i}`),
      empresa: r.empresa ?? r.lead_id ?? "—",
      canal: r.canal ?? "—",
      status: r.status ?? "—",
      created_at: r.created_at ?? null,
    })),
  };
}

// ============================================================
// TOUCHPOINTS
// ============================================================
async function fetchTouchpoints(
  period: ResolvedPeriod,
  params: { canal?: string; empresa?: string } = {},
): Promise<DrillResult> {
  const rows = await safeSelect<Record<string, unknown>>(
    "prospect_touchpoints",
    "id, prospect_id, empresa, tipo, canal, status, enviado_em",
    dateBetween("enviado_em", period),
  );
  const filtered = rows.filter((r) => {
    const okCanal = params.canal
      ? String(r.tipo ?? r.canal ?? "").toLowerCase() ===
        String(params.canal).toLowerCase()
      : true;
    const okEmpresa = params.empresa
      ? String(r.empresa ?? "")
          .toLowerCase()
          .includes(String(params.empresa).toLowerCase())
      : true;
    return okCanal && okEmpresa;
  });
  return {
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "tipo", label: "Tipo", format: "badge" },
      { key: "status", label: "Status", format: "badge" },
      { key: "enviado_em", label: "Quando", format: "date" },
    ],
    rows: filtered.map((r, i) => ({
      id: String(r.id ?? `t-${i}`),
      empresa: r.empresa ?? r.prospect_id ?? "—",
      tipo: r.tipo ?? r.canal ?? "—",
      status: r.status ?? "—",
      enviado_em: r.enviado_em ?? null,
    })),
  };
}

// ============================================================
// PROSPECTS novos
// ============================================================
async function fetchProspectsNew(period: ResolvedPeriod): Promise<DrillResult> {
  const rows = await safeSelect<Record<string, unknown>>(
    "prospects",
    "id, empresa, responsavel, whatsapp, status, created_at",
    dateBetween("created_at", period),
  );
  return {
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "responsavel", label: "Responsável" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "status", label: "Status", format: "badge" },
      { key: "created_at", label: "Cadastrado", format: "date" },
    ],
    rows: rows.map((r, i) => ({
      id: String(r.id ?? `p-${i}`),
      empresa: r.empresa ?? "—",
      responsavel: r.responsavel ?? "—",
      whatsapp: r.whatsapp ?? "—",
      status: r.status ?? "—",
      created_at: r.created_at ?? null,
    })),
  };
}

// ============================================================
// EMPRESAS trabalhadas no período (touchpoints distintos)
// ============================================================
async function fetchEmpresas(period: ResolvedPeriod): Promise<DrillResult> {
  const rows = await safeSelect<Record<string, unknown>>(
    "prospect_touchpoints",
    "empresa, enviado_em",
    dateBetween("enviado_em", period),
  );
  const map = new Map<string, { empresa: string; total: number; ultimo: string | null }>();
  for (const r of rows) {
    const k = String(r.empresa ?? "—");
    const cur = map.get(k) ?? { empresa: k, total: 0, ultimo: null };
    cur.total += 1;
    const env = r.enviado_em as string | null;
    if (env && (!cur.ultimo || env > cur.ultimo)) cur.ultimo = env;
    map.set(k, cur);
  }
  const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
  return {
    valueLabel: "Touchpoints",
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "total", label: "Touchpoints", format: "number" },
      { key: "ultimo", label: "Último contato", format: "date" },
    ],
    rows: list.map((r, i) => ({
      id: `e-${i}-${r.empresa}`,
      _value: r.total,
      empresa: r.empresa,
      total: r.total,
      ultimo: r.ultimo,
      _drillTo: {
        kind: "touchpoints" as const,
        title: `Histórico — ${r.empresa}`,
        params: { empresa: r.empresa },
      },
    })),
  };
}

export async function fetchDrillDown(
  kind: DrillKind,
  params: Record<string, unknown> | undefined,
  period: ResolvedPeriod,
): Promise<DrillResult> {
  switch (kind) {
    case "contracts":
    case "contracts-status":
      return fetchContracts(period, params as { status?: string });
    case "leads-stage":
      return fetchLeadsStage(period, params as { stage?: string });
    case "proposals":
      return fetchProposals(period);
    case "dispatches":
      return fetchDispatches(period);
    case "touchpoints":
    case "touchpoints-channel":
      return fetchTouchpoints(
        period,
        params as { canal?: string; empresa?: string },
      );
    case "prospects-new":
      return fetchProspectsNew(period);
    case "empresas":
      return fetchEmpresas(period);
    case "churn-risk":
      return fetchContracts(period, { status: "risco" });
  }
}
