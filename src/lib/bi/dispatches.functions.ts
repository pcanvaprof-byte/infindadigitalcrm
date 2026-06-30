import { createServerFn } from "@tanstack/react-start";

/**
 * Auditoria consistente de disparos calculada 100% no backend, lendo o banco
 * canônico do INFINDA (OWN_SB) via service role. O endpoint suporta:
 *  - intervalo arbitrário (data + hora)
 *  - presets (hoje, ontem, 7d, semana)
 *  - breakdown por canal, por tipo, por cadência (stage) e por campanha/origem
 *  - série diária dos últimos N dias
 *  - linhas brutas para exportação CSV
 */

type Range = { from: string; to: string; label: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function localTs(d: Date): string {
  // Servidor roda em UTC; usamos offset fixo America/Sao_Paulo (-03:00).
  const off = -180; // minutes east of UTC = -180 → "-03:00"
  const sign = off >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  // d já vem em UTC; convertemos para horário SP
  const sp = new Date(d.getTime() + off * 60_000);
  return (
    `${sp.getUTCFullYear()}-${pad(sp.getUTCMonth() + 1)}-${pad(sp.getUTCDate())}` +
    `T${pad(sp.getUTCHours())}:${pad(sp.getUTCMinutes())}:${pad(sp.getUTCSeconds())}` +
    `${sign}${oh}:${om}`
  );
}
function spNow(): Date {
  return new Date(Date.now() - 180 * 60_000);
}
function dayRange(daysAgo = 0): Range {
  const now = spNow();
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const a = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
  const b = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  // converte de "SP-local 00:00" para timestamp UTC equivalente: SP = UTC-3 → UTC = SP + 3h
  const aUtc = new Date(a.getTime() + 180 * 60_000);
  const bUtc = new Date(b.getTime() + 180 * 60_000);
  return { from: localTs(aUtc), to: localTs(bUtc), label: daysAgo === 0 ? "hoje" : `d-${daysAgo}` };
}
function rangeLastDays(n: number): Range {
  const a = dayRange(n - 1).from;
  const b = dayRange(0).to;
  return { from: a, to: b, label: `${n}d` };
}

const OUTBOUND_TYPES = ["whatsapp", "ligacao", "email", "reuniao"] as const;

async function ownClient() {
  // Lazy import para não vazar o módulo server-only no bundle do client.
  // Usa OWN_SB (banco canônico do INFINDA) com service role para garantir
  // contagem consistente independente do usuário.
  const url = process.env.OWN_SB_URL;
  const key = process.env.OWN_SB_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("OWN_SB env não configurado");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface DispatchBucket {
  range: Range;
  total: number;
  cadencia: number;
  prospeccao: number;
  por_tipo: Record<string, number>;
  por_canal: { cad_messages: number; prospect_touchpoints: number };
  por_cadencia: Array<{ stage: string; total: number }>;
  por_campanha: Array<{ campanha: string; total: number }>;
}

export interface DispatchAuditResult {
  generated_at: string;
  source: "OWN_SB";
  today: DispatchBucket;
  yesterday: DispatchBucket;
  last7d: DispatchBucket;
  daily_series: Array<{ date: string; cadencia: number; prospeccao: number; total: number }>;
  custom?: DispatchBucket;
}

type CadRow = { id: string; created_at: string; lead_id: string | null; tipo: string | null; direction: string | null };
type TpRow = { id: string; enviado_em: string; tipo: string; prospect_id: string | null };

async function fetchBucket(range: Range): Promise<{
  bucket: DispatchBucket;
  cadRows: CadRow[];
  tpRows: TpRow[];
}> {
  const sb = ownClient();
  // Paginação simples (limite 5k) — auditoria diária dificilmente passa disso.
  const [cadRes, tpRes] = await Promise.all([
    sb.from("cad_messages")
      .select("id, created_at, lead_id, tipo, direction")
      .gte("created_at", range.from)
      .lte("created_at", range.to)
      .neq("tipo", "sistema")
      .order("created_at", { ascending: true })
      .limit(5000),
    sb.from("prospect_touchpoints")
      .select("id, enviado_em, tipo, prospect_id")
      .gte("enviado_em", range.from)
      .lte("enviado_em", range.to)
      .in("tipo", OUTBOUND_TYPES as unknown as string[])
      .order("enviado_em", { ascending: true })
      .limit(5000),
  ]);
  if (cadRes.error) throw cadRes.error;
  if (tpRes.error) throw tpRes.error;
  const cadRows = (cadRes.data ?? []) as CadRow[];
  const tpRows = (tpRes.data ?? []) as TpRow[];

  // Por tipo
  const por_tipo: Record<string, number> = { whatsapp: 0, ligacao: 0, email: 0, reuniao: 0 };
  for (const r of tpRows) por_tipo[r.tipo] = (por_tipo[r.tipo] ?? 0) + 1;
  // cad_messages: cadência é primariamente WhatsApp
  por_tipo.whatsapp += cadRows.length;

  // Por cadência (stage do lead na hora do envio)
  const leadIds = [...new Set(cadRows.map((r) => r.lead_id).filter(Boolean))] as string[];
  let leadById: Record<string, { empresa: string | null; stage: string | null }> = {};
  if (leadIds.length) {
    const { data } = await sb.from("cad_leads").select("id, empresa, stage").in("id", leadIds);
    for (const l of (data ?? []) as Array<{ id: string; empresa: string | null; stage: string | null }>) {
      leadById[l.id] = { empresa: l.empresa, stage: l.stage };
    }
  }
  const stageMap = new Map<string, number>();
  for (const r of cadRows) {
    const stage = (r.lead_id && leadById[r.lead_id]?.stage) || "sem_stage";
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
  }
  const por_cadencia = [...stageMap.entries()]
    .map(([stage, total]) => ({ stage, total }))
    .sort((a, b) => b.total - a.total);

  // Por campanha/origem (source do prospect)
  const prospectIds = [...new Set(tpRows.map((r) => r.prospect_id).filter(Boolean))] as string[];
  const sourceByProspect: Record<string, string> = {};
  if (prospectIds.length) {
    const { data } = await sb.from("prospects").select("id, source").in("id", prospectIds);
    for (const p of (data ?? []) as Array<{ id: string; source: string | null }>) {
      sourceByProspect[p.id] = p.source || "Sem origem";
    }
  }
  const campMap = new Map<string, number>();
  for (const r of tpRows) {
    const c = (r.prospect_id && sourceByProspect[r.prospect_id]) || "Sem origem";
    campMap.set(c, (campMap.get(c) ?? 0) + 1);
  }
  const por_campanha = [...campMap.entries()]
    .map(([campanha, total]) => ({ campanha, total }))
    .sort((a, b) => b.total - a.total);

  const bucket: DispatchBucket = {
    range,
    total: cadRows.length + tpRows.length,
    cadencia: cadRows.length,
    prospeccao: tpRows.length,
    por_tipo,
    por_canal: { cad_messages: cadRows.length, prospect_touchpoints: tpRows.length },
    por_cadencia,
    por_campanha,
  };
  return { bucket, cadRows, tpRows };
}

function spDateKey(iso: string): string {
  // ISO já em -03:00 ou UTC; converte para a chave de dia SP.
  const d = new Date(iso);
  const sp = new Date(d.getTime() - 180 * 60_000);
  return `${sp.getUTCFullYear()}-${pad(sp.getUTCMonth() + 1)}-${pad(sp.getUTCDate())}`;
}

export const auditDispatches = createServerFn({ method: "POST" })
  .inputValidator((input: { from?: string; to?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    // ----- Cache + rate-limit (in-memory, por instância do worker) -----
    // Não há primitiva de rate-limit oficial no backend; este controle é
    // best-effort para evitar consultas repetidas. Persistência distribuída
    // exigiria uma tabela/edge dedicada, fora do escopo deste endpoint.
    const cacheKey = data?.from && data?.to ? `${data.from}|${data.to}` : "__default__";
    const cached = AUDIT_CACHE.get(cacheKey);
    const nowMs = Date.now();
    if (cached && nowMs - cached.at < AUDIT_TTL_MS) {
      return cached.payload;
    }
    if (!checkRateLimit()) {
      // Se houver versão em cache (mesmo expirada), devolve a stale com aviso —
      // melhor consistência eventual do que erro 429 num dashboard interno.
      if (cached) return cached.payload;
      throw new Error("rate_limit_exceeded: auditDispatches");
    }

    const today = dayRange(0);
    const yesterday = dayRange(1);
    const last7d = rangeLastDays(7);

    const [t, ye, w] = await Promise.all([
      fetchBucket(today),
      fetchBucket(yesterday),
      fetchBucket(last7d),
    ]);

    // Série diária a partir do bucket de 7d (sem rodar query extra).
    const daily = new Map<string, { cadencia: number; prospeccao: number }>();
    for (let i = 6; i >= 0; i--) {
      const k = dayRange(i).from.slice(0, 10);
      daily.set(k, { cadencia: 0, prospeccao: 0 });
    }
    for (const r of w.cadRows) {
      const k = spDateKey(r.created_at);
      const cur = daily.get(k) ?? { cadencia: 0, prospeccao: 0 };
      cur.cadencia += 1;
      daily.set(k, cur);
    }
    for (const r of w.tpRows) {
      const k = spDateKey(r.enviado_em);
      const cur = daily.get(k) ?? { cadencia: 0, prospeccao: 0 };
      cur.prospeccao += 1;
      daily.set(k, cur);
    }
    const daily_series = [...daily.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, ...v, total: v.cadencia + v.prospeccao }));

    let custom: DispatchBucket | undefined;
    if (data?.from && data?.to) {
      const a = new Date(data.from);
      const b = new Date(data.to);
      const range: Range = { from: localTs(a), to: localTs(b), label: "custom" };
      custom = (await fetchBucket(range)).bucket;
    }

    const result: DispatchAuditResult = {
      generated_at: new Date().toISOString(),
      source: "OWN_SB",
      today: t.bucket,
      yesterday: ye.bucket,
      last7d: w.bucket,
      daily_series,
      custom,
    };
    AUDIT_CACHE.set(cacheKey, { at: nowMs, payload: result });
    return result;
  });

// =====================================================================
// Cache + rate-limit (in-memory). TTL curto: dashboard recarrega <=1/min.
// =====================================================================
const AUDIT_TTL_MS = 30_000;
const AUDIT_CACHE = new Map<string, { at: number; payload: DispatchAuditResult }>();
const RL_WINDOW_MS = 60_000;
const RL_MAX = 30; // 30 chamadas/min por instância
const RL_HITS: number[] = [];
function checkRateLimit(): boolean {
  const now = Date.now();
  while (RL_HITS.length && now - RL_HITS[0] > RL_WINDOW_MS) RL_HITS.shift();
  if (RL_HITS.length >= RL_MAX) return false;
  RL_HITS.push(now);
  return true;
}

// =====================================================================
// Exportação CSV: retorna linhas brutas combinadas (cadência + prospecção)
// para o intervalo solicitado. Cabe ao frontend transformar em CSV.
// =====================================================================

export interface DispatchRow {
  ts: string;
  origem: "cadencia" | "prospeccao";
  tipo: string;
  empresa: string | null;
  stage: string | null;
  campanha: string | null;
  id: string;
}

export const listDispatchRows = createServerFn({ method: "POST" })
  .inputValidator((input: { from: string; to: string }) => {
    if (!input?.from || !input?.to) throw new Error("from/to obrigatórios");
    return input;
  })
  .handler(async ({ data }) => {
    const range: Range = {
      from: localTs(new Date(data.from)),
      to: localTs(new Date(data.to)),
      label: "csv",
    };
    const { cadRows, tpRows } = await fetchBucket(range);
    const sb = ownClient();

    const leadIds = [...new Set(cadRows.map((r) => r.lead_id).filter(Boolean))] as string[];
    const leadById: Record<string, { empresa: string | null; stage: string | null }> = {};
    if (leadIds.length) {
      const { data: ld } = await sb.from("cad_leads").select("id, empresa, stage").in("id", leadIds);
      for (const l of (ld ?? []) as Array<{ id: string; empresa: string | null; stage: string | null }>) {
        leadById[l.id] = l;
      }
    }
    const prospectIds = [...new Set(tpRows.map((r) => r.prospect_id).filter(Boolean))] as string[];
    const prospectById: Record<string, { company: string | null; source: string | null }> = {};
    if (prospectIds.length) {
      const { data: pd } = await sb.from("prospects").select("id, company, source").in("id", prospectIds);
      for (const p of (pd ?? []) as Array<{ id: string; company: string | null; source: string | null }>) {
        prospectById[p.id] = p;
      }
    }

    const rows: DispatchRow[] = [
      ...cadRows.map<DispatchRow>((r) => ({
        ts: r.created_at,
        origem: "cadencia",
        tipo: r.tipo || "whatsapp",
        empresa: (r.lead_id && leadById[r.lead_id]?.empresa) || null,
        stage: (r.lead_id && leadById[r.lead_id]?.stage) || null,
        campanha: null,
        id: r.id,
      })),
      ...tpRows.map<DispatchRow>((r) => ({
        ts: r.enviado_em,
        origem: "prospeccao",
        tipo: r.tipo,
        empresa: (r.prospect_id && prospectById[r.prospect_id]?.company) || null,
        stage: null,
        campanha: (r.prospect_id && prospectById[r.prospect_id]?.source) || null,
        id: r.id,
      })),
    ].sort((a, b) => (a.ts < b.ts ? -1 : 1));
    return rows;
  });