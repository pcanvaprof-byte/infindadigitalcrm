import { supabase as sb } from "@/integrations/supabase/client";
import { localTimestamp, getCurrentOrgId } from "./tz";
import type { ResolvedPeriod } from "./period";

/**
 * Meios de Prospecção — agregação client-side dos canais de aquisição.
 * Sem novas tabelas/RPCs: lê apenas o que já existe (cad_leads, propostas,
 * contratos, prospect_touchpoints) e classifica heuristicamente a origem.
 */

export type ProspectSource =
  | "visita"
  | "whatsapp"
  | "cadencia"
  | "indicacao"
  | "parceria"
  | "conteudo"
  | "remarketing"
  | "trafego"
  | "outros";

export const SOURCE_LABEL: Record<ProspectSource, string> = {
  visita: "Visitas",
  whatsapp: "WhatsApp",
  cadencia: "Cadência",
  indicacao: "Indicações",
  parceria: "Parcerias",
  conteudo: "Conteúdo",
  remarketing: "Remarketing",
  trafego: "Tráfego Pago",
  outros: "Outros",
};

export interface ChannelMetrics {
  source: ProspectSource;
  label: string;
  leads: number;
  reunioes: number;
  propostas: number;
  contratos: number;
  receita: number;
  recorrencia: number;
  conversao: number; // contratos / leads (%)
  ticketMedio: number; // receita / contratos
  meta: number;
  realizado: number; // = leads (atividade prospecção do canal)
}

export interface MeiosData {
  channels: ChannelMetrics[];
  totals: {
    leads: number;
    contratos: number;
    receita: number;
    recorrencia: number;
  };
  best: ChannelMetrics | null;
  worst: ChannelMetrics | null;
  insight: string;
}

// Heurística de classificação por texto livre (origem / fonte / canal / nota).
export function classifySource(...candidates: Array<string | null | undefined>): ProspectSource {
  const s = candidates.filter(Boolean).join(" ").toLowerCase();
  if (!s) return "outros";
  if (/(visita|presenc|in.?loco|porta|rua)/.test(s)) return "visita";
  if (/(whats|wpp|zap)/.test(s)) return "whatsapp";
  if (/(cad[eê]ncia|sequence|fluxo)/.test(s)) return "cadencia";
  if (/(indic|referr|networ)/.test(s)) return "indicacao";
  if (/(parceir|partner|afili)/.test(s)) return "parceria";
  if (/(conte[uú]do|blog|youtube|instagram|reel|seo)/.test(s)) return "conteudo";
  if (/(remarket|retarget)/.test(s)) return "remarketing";
  if (/(google ads|ads|meta ads|trafego|tráfego|paid|cpc)/.test(s)) return "trafego";
  return "outros";
}

type Row = Record<string, unknown>;

async function safeSelect(table: string, columns: string, period?: ResolvedPeriod, dateCol?: string): Promise<Row[]> {
  try {
    let q: any = sb.from(table as never).select(columns).limit(5000);
    const orgId = await getCurrentOrgId();
    let orgApplied = false;
    if (orgId) {
      try { q = q.eq("organization_id", orgId); orgApplied = true; } catch { /* no-op */ }
    }
    let ini: string | undefined;
    let fim: string | undefined;
    if (period && dateCol) {
      try {
        ini = localTimestamp(period.from);
        fim = localTimestamp(period.to);
        q = q.gte(dateCol, ini).lte(dateCol, fim);
      } catch { /* no-op */ }
    }
    const { data, error } = await q;
    if (error) {
      // eslint-disable-next-line no-console
      console.warn(`[bi:meios] ${table}.${dateCol ?? "—"} ERRO`, { orgApplied, ini, fim, error: (error as any).message ?? error });
      // Retry sem org filter — algumas tabelas podem ter org_id NULL em dados legados.
      if (orgApplied) {
        try {
          let q2: any = sb.from(table as never).select(columns).limit(5000);
          if (ini && fim && dateCol) q2 = q2.gte(dateCol, ini).lte(dateCol, fim);
          const r2 = await q2;
          if (!r2.error) {
            // eslint-disable-next-line no-console
            console.log(`[bi:meios] ${table} (sem org) → ${(r2.data ?? []).length} linhas`);
            return (r2.data ?? []) as Row[];
          }
        } catch { /* no-op */ }
      }
      return [];
    }
    const rows = (data ?? []) as Row[];
    // eslint-disable-next-line no-console
    console.log(`[bi:meios] ${table}.${dateCol ?? "—"} → ${rows.length} linhas`, { orgApplied, ini, fim });
    return rows;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[bi:meios] ${table} EXCEPTION`, e);
    return [];
  }
}

function pick<T = string>(r: Row, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const DEFAULT_META: Record<ProspectSource, number> = {
  visita: 150,
  whatsapp: 200,
  cadencia: 240,
  indicacao: 20,
  parceria: 4,
  conteudo: 8,
  remarketing: 50,
  trafego: 100,
  outros: 0,
};

const STORAGE_KEY = "bi.meios.metas.v1";

export function readChannelGoals(): Record<ProspectSource, number> {
  if (typeof window === "undefined") return { ...DEFAULT_META };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function writeChannelGoals(g: Partial<Record<ProspectSource, number>>) {
  if (typeof window === "undefined") return;
  const merged = { ...readChannelGoals(), ...g };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

/** Busca, classifica e agrega métricas por canal para o período. */
export async function fetchMeiosProspeccao(period: ResolvedPeriod): Promise<MeiosData> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[bi:meios] coleta ${period.key} (${period.label})`);
  // eslint-disable-next-line no-console
  console.log("[bi:meios] período", { from: period.from, to: period.to, tz });
  // Leads — tenta cad_leads, prospects.
  const leadsRaw =
    (await safeSelect("cad_leads", "id, empresa, source, origem, fonte, canal, status, created_at", period, "created_at"))
      .concat(await safeSelect("prospects", "id, empresa, origem, fonte, canal, status, created_at", period, "created_at"));

  const propostasRaw =
    (await safeSelect("propostas", "id, empresa, source, origem, valor, status, created_at", period, "created_at"));

  const contratosRaw =
    (await safeSelect("contracts", "id, empresa, source, origem, monthly_value, contract_value, value, signed_at, status", period, "signed_at"))
      .concat(await safeSelect("op_contracts", "id, empresa, source, origem, monthly_value, contract_value, signed_at, status", period, "signed_at"));

  const touchpointsRaw =
    (await safeSelect("prospect_touchpoints", "id, empresa, channel, canal, type, tipo, created_at", period, "created_at"));

  // eslint-disable-next-line no-console
  console.log("[bi:meios] coletas brutas", {
    leads: leadsRaw.length,
    propostas: propostasRaw.length,
    contratos: contratosRaw.length,
    touchpoints: touchpointsRaw.length,
  });

  // Index leads by empresa → source (para herdar origem em proposta/contrato sem origem própria).
  const sourceByEmpresa = new Map<string, ProspectSource>();
  for (const r of leadsRaw) {
    const empresa = String(pick(r, "empresa") ?? "").trim().toLowerCase();
    if (!empresa) continue;
    const src = classifySource(pick(r, "source"), pick(r, "origem"), pick(r, "fonte"), pick(r, "canal"));
    if (!sourceByEmpresa.has(empresa)) sourceByEmpresa.set(empresa, src);
  }

  const ensure = (m: Map<ProspectSource, ChannelMetrics>, s: ProspectSource): ChannelMetrics => {
    let c = m.get(s);
    if (!c) {
      const goals = readChannelGoals();
      c = {
        source: s,
        label: SOURCE_LABEL[s],
        leads: 0, reunioes: 0, propostas: 0, contratos: 0,
        receita: 0, recorrencia: 0, conversao: 0, ticketMedio: 0,
        meta: goals[s] ?? 0, realizado: 0,
      };
      m.set(s, c);
    }
    return c;
  };

  const map = new Map<ProspectSource, ChannelMetrics>();

  const resolveSource = (r: Row): ProspectSource => {
    const direct = classifySource(pick(r, "source"), pick(r, "origem"), pick(r, "fonte"), pick(r, "canal"));
    if (direct !== "outros") return direct;
    const empresa = String(pick(r, "empresa") ?? "").trim().toLowerCase();
    return (empresa && sourceByEmpresa.get(empresa)) || "outros";
  };

  for (const r of leadsRaw) ensure(map, resolveSource(r)).leads += 1;
  for (const r of propostasRaw) ensure(map, resolveSource(r)).propostas += 1;

  for (const r of contratosRaw) {
    const c = ensure(map, resolveSource(r));
    c.contratos += 1;
    const monthly = num(pick(r, "monthly_value"));
    const total = num(pick(r, "contract_value", "value")) || monthly;
    c.receita += total;
    c.recorrencia += monthly;
  }

  for (const r of touchpointsRaw) {
    const t = String(pick(r, "type", "tipo") ?? "").toLowerCase();
    if (!/reuni|meeting/.test(t)) continue;
    const empresa = String(pick(r, "empresa") ?? "").trim().toLowerCase();
    const channelHint = String(pick(r, "channel", "canal") ?? "");
    const direct = classifySource(channelHint);
    const src = direct !== "outros" ? direct : (sourceByEmpresa.get(empresa) ?? "outros");
    ensure(map, src).reunioes += 1;
  }

  const channels = Array.from(map.values()).map((c) => {
    c.realizado = c.leads;
    c.conversao = c.leads > 0 ? +((c.contratos / c.leads) * 100).toFixed(1) : 0;
    c.ticketMedio = c.contratos > 0 ? Math.round(c.receita / c.contratos) : 0;
    return c;
  });

  // Garante todos os canais conhecidos para visualização consistente.
  for (const s of Object.keys(SOURCE_LABEL) as ProspectSource[]) {
    if (!map.has(s)) ensure(map, s);
  }
  const all = Array.from(map.values())
    .map((c) => {
      c.realizado = c.leads;
      c.conversao = c.leads > 0 ? +((c.contratos / c.leads) * 100).toFixed(1) : 0;
      c.ticketMedio = c.contratos > 0 ? Math.round(c.receita / c.contratos) : 0;
      return c;
    })
    .sort((a, b) => b.receita - a.receita || b.contratos - a.contratos);

  const totals = all.reduce(
    (acc, c) => {
      acc.leads += c.leads;
      acc.contratos += c.contratos;
      acc.receita += c.receita;
      acc.recorrencia += c.recorrencia;
      return acc;
    },
    { leads: 0, contratos: 0, receita: 0, recorrencia: 0 },
  );

  // eslint-disable-next-line no-console
  console.log("[bi:meios] totais agregados", totals);
  // eslint-disable-next-line no-console
  console.groupEnd();

  const withActivity = all.filter((c) => c.leads + c.contratos > 0);
  const best = withActivity[0] ?? null;
  const worst = withActivity.length > 1
    ? [...withActivity].sort((a, b) => a.conversao - b.conversao || a.receita - b.receita)[0]
    : null;

  // Insight executivo automático.
  let insight = "Sem atividade de prospecção registrada no período.";
  if (best && totals.receita > 0) {
    const pctReceita = Math.round((best.receita / totals.receita) * 100);
    const pctLeads = totals.leads > 0 ? Math.round((best.leads / totals.leads) * 100) : 0;
    insight = `${best.label} representa ${pctLeads}% dos leads e ${pctReceita}% da receita do período.`;
    if (worst && worst.source !== best.source && worst.leads > 0) {
      insight += ` ${worst.label}: ${worst.leads} ações geraram ${worst.contratos} contratos (${worst.conversao}%).`;
    }
  }

  return { channels: all, totals, best, worst, insight };
}