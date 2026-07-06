import { supabase } from "@/integrations/supabase/client";
import type {
  Proposal,
  ProposalItem,
  ProposalEvent,
  ProposalVersion,
  ProposalContent,
  PublicProposal,
  Cobranca,
  ProposalAdjustment,
  ProposalAdjustmentStatus,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const propostasKeys = {
  all: ["propostas"] as const,
  one: (id: string) => ["propostas", id] as const,
  items: (id: string) => ["propostas", id, "items"] as const,
  events: (id: string) => ["propostas", id, "events"] as const,
  versions: (id: string) => ["propostas", id, "versions"] as const,
  adjustments: (id: string) => ["propostas", id, "adjustments"] as const,
  stats: ["propostas", "stats"] as const,
};

function num(v: unknown, d = 0): number {
  const n = Number(v ?? d);
  return Number.isFinite(n) ? n : d;
}

function normProposal(r: Record<string, unknown>): Proposal {
  return {
    ...(r as unknown as Proposal),
    valor_implantacao: num(r.valor_implantacao),
    valor_mensal: num(r.valor_mensal),
    valor_avulso: num(r.valor_avulso),
    desconto_pct: num(r.desconto_pct),
    validade_dias: num(r.validade_dias, 7),
  };
}

function normItem(r: Record<string, unknown>): ProposalItem {
  return {
    ...(r as unknown as ProposalItem),
    quantidade: num(r.quantidade, 1),
    valor_unitario: num(r.valor_unitario),
    valor_total: num(r.valor_total),
    entregaveis: (r.entregaveis as string[] | null) ?? [],
  };
}

export async function listProposals(): Promise<Proposal[]> {
  const { data, error } = await sb
    .from("proposals")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(normProposal);
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const { data, error } = await sb.from("proposals").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normProposal(data) : null;
}

export async function listItems(proposalId: string): Promise<ProposalItem[]> {
  const { data, error } = await sb
    .from("proposal_items")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("ordem", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(normItem);
}

export async function listVersions(proposalId: string): Promise<ProposalVersion[]> {
  const { data, error } = await sb
    .from("proposal_versions")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProposalVersion[];
}

export async function listEvents(proposalId: string): Promise<ProposalEvent[]> {
  const { data, error } = await sb
    .from("proposal_events")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProposalEvent[];
}

export async function createProposalFromDeal(dealId: string, titulo?: string): Promise<string> {
  const { data, error } = await sb.rpc("create_proposal_from_source", {
    p_deal_id: dealId,
    p_prospect_id: null,
    p_titulo: titulo ?? "Proposta Comercial",
  });
  if (error) throw error;
  return data as string;
}

export async function createProposalFromProspect(prospectId: string, titulo?: string): Promise<string> {
  const { data, error } = await sb.rpc("create_proposal_from_source", {
    p_deal_id: null,
    p_prospect_id: prospectId,
    p_titulo: titulo ?? "Proposta Comercial",
  });
  if (error) throw error;
  return data as string;
}

export async function createProposalBlank(titulo?: string): Promise<string> {
  const { data, error } = await sb.rpc("create_proposal_from_source", {
    p_deal_id: null,
    p_prospect_id: null,
    p_titulo: titulo ?? "Proposta Comercial",
  });
  if (error) throw error;
  return data as string;
}

export async function updateProposal(id: string, patch: Partial<Proposal>): Promise<void> {
  const { error } = await sb.from("proposals").update(patch).eq("id", id);
  if (error) throw error;
}

export async function addItemFromCatalog(
  proposalId: string,
  catalogItem: {
    id: string;
    nome_comercial: string;
    descricao_curta?: string | null;
    categoria_nome?: string | null;
    area_responsavel?: string | null;
    cobranca: Cobranca;
    valor_implantacao: number;
    valor_mensal: number;
    valor_avulso: number;
    prazo_estimado_dias?: number | null;
    entregaveis?: string[];
  },
  ordem: number,
): Promise<void> {
  const valorUnit =
    catalogItem.cobranca === "mensal"
      ? catalogItem.valor_mensal
      : catalogItem.cobranca === "avulso"
        ? catalogItem.valor_avulso
        : catalogItem.valor_implantacao;
  const { error } = await sb.from("proposal_items").insert({
    proposal_id: proposalId,
    catalog_item_id: catalogItem.id,
    nome: catalogItem.nome_comercial,
    descricao: catalogItem.descricao_curta ?? null,
    categoria: catalogItem.categoria_nome ?? null,
    area: catalogItem.area_responsavel ?? null,
    cobranca: catalogItem.cobranca,
    quantidade: 1,
    valor_unitario: valorUnit,
    valor_total: valorUnit,
    prazo_dias: catalogItem.prazo_estimado_dias ?? null,
    entregaveis: catalogItem.entregaveis ?? [],
    ordem,
  });
  if (error) throw error;
}

export async function updateItem(itemId: string, patch: Partial<ProposalItem>): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  if ("quantidade" in patch || "valor_unitario" in patch) {
    const q = num(patch.quantidade, 1);
    const u = num(patch.valor_unitario);
    next.valor_total = q * u;
  }
  const { error } = await sb.from("proposal_items").update(next).eq("id", itemId);
  if (error) throw error;
}

export async function removeItem(itemId: string): Promise<void> {
  const { error } = await sb.from("proposal_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function saveVersion(
  proposalId: string,
  conteudo: ProposalContent,
  observacoes?: string,
): Promise<string> {
  const { data, error } = await sb.rpc("create_proposal_version", {
    p_proposal_id: proposalId,
    p_conteudo: conteudo,
    p_observacoes: observacoes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function getCurrentVersion(proposalId: string): Promise<ProposalVersion | null> {
  const p = await getProposal(proposalId);
  if (!p?.current_version_id) return null;
  const { data, error } = await sb
    .from("proposal_versions")
    .select("*")
    .eq("id", p.current_version_id)
    .maybeSingle();
  if (error) throw error;
  return data as ProposalVersion | null;
}

export async function registerSend(
  proposalId: string,
  canal: "link" | "whatsapp" | "email",
  destino?: string,
  mensagem?: string,
): Promise<void> {
  const { error } = await sb.rpc("register_proposal_send", {
    p_proposal_id: proposalId,
    p_canal: canal,
    p_destino: destino ?? null,
    p_mensagem: mensagem ?? null,
  });
  if (error) throw error;
}

// -------- Público (sem login) --------
export async function getProposalByToken(token: string): Promise<PublicProposal | null> {
  const { data, error } = await sb.rpc("get_proposal_by_token", { p_token: token });
  if (error) throw error;
  return (data as PublicProposal | null) ?? null;
}

export async function registerProposalView(token: string): Promise<void> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const ref = typeof document !== "undefined" ? document.referrer : null;
  const { error } = await sb.rpc("register_proposal_view", {
    p_token: token,
    p_ua: ua,
    p_referrer: ref,
  });
  if (error) throw error;
}

export async function submitProposalDecision(args: {
  token: string;
  decisao: "aprovada" | "ajustes" | "rejeitada";
  nome: string;
  cargo?: string;
  documento?: string;
  mensagem?: string;
}): Promise<{ status: string; briefing_token?: string }> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { data, error } = await sb.rpc("submit_proposal_decision", {
    p_token: args.token,
    p_decisao: args.decisao,
    p_nome: args.nome,
    p_cargo: args.cargo ?? null,
    p_documento: args.documento ?? null,
    p_mensagem: args.mensagem ?? null,
    p_ua: ua,
  });
  if (error) throw error;
  return (data as { status: string; briefing_token?: string }) ?? { status: "ok" };
}

// -------- Stats / Funil --------
export interface ProposalStats {
  total: number;
  rascunho: number;
  enviadas: number;
  visualizadas: number;
  aprovadas: number;
  rejeitadas: number;
  expiradas: number;
  ticketMedio: number;
  valorTotalEnviado: number;
  valorTotalAprovado: number;
  valorPerdido: number;
  taxaAprovacao: number;
  tempoMedioVisualizacaoH: number;
  tempoMedioAprovacaoH: number;
}

/**
 * @deprecated Etapa 6 — KPIs vivem em `vw_proposal_kpis` / `vw_proposal_conversion`.
 * Use `fetchProposalKPIs()` de `@/lib/propostas/bi`. Mantido só como fallback
 * de leitura local em telas sem acesso a view (ex.: relatórios exportados).
 */
export function computeStats(items: Proposal[]): ProposalStats {
  const total = items.length;
  const by = (s: string) => items.filter((p) => p.status === s);
  const enviadas = items.filter((p) =>
    ["enviada", "visualizada", "ajustes_solicitados", "aprovada", "rejeitadas", "rejeitada", "expirada", "convertida"].includes(p.status),
  );
  const visualizadas = items.filter((p) => p.first_viewed_at);
  const aprovadas = by("aprovada").concat(by("convertida"));
  const rejeitadas = by("rejeitada");
  const expiradas = by("expirada");

  const valorOf = (p: Proposal) => p.valor_implantacao + p.valor_mensal * 12;
  const valorTotalEnviado = enviadas.reduce((s, p) => s + valorOf(p), 0);
  const valorTotalAprovado = aprovadas.reduce((s, p) => s + valorOf(p), 0);
  const valorPerdido = rejeitadas.concat(expiradas).reduce((s, p) => s + valorOf(p), 0);

  const ticketMedio = aprovadas.length ? valorTotalAprovado / aprovadas.length : 0;
  const taxaAprovacao = enviadas.length ? (aprovadas.length / enviadas.length) * 100 : 0;

  const hours = (a: string | null, b: string | null) =>
    a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000 : null;
  const visTimes = items
    .map((p) => hours(p.sent_at, p.first_viewed_at))
    .filter((v): v is number => v !== null && v >= 0);
  const aprTimes = items
    .map((p) => hours(p.sent_at, p.decided_at))
    .filter((v): v is number => v !== null && v >= 0);
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

  return {
    total,
    rascunho: by("rascunho").length,
    enviadas: enviadas.length,
    visualizadas: visualizadas.length,
    aprovadas: aprovadas.length,
    rejeitadas: rejeitadas.length,
    expiradas: expiradas.length,
    ticketMedio,
    valorTotalEnviado,
    valorTotalAprovado,
    valorPerdido,
    taxaAprovacao,
    tempoMedioVisualizacaoH: avg(visTimes),
    tempoMedioAprovacaoH: avg(aprTimes),
  };
}

/**
 * URL base pública usada nos links de proposta enviados ao cliente.
 *
 * Ordem de precedência:
 * 1. VITE_PUBLIC_SITE_URL (defina como o domínio customizado, ex: https://propostas.infinda.com.br)
 * 2. Domínio atual quando NÃO é preview da Lovable (assim funciona no domínio publicado/custom)
 * 3. Fallback: domínio publicado padrão do projeto
 */
const FALLBACK_PUBLIC_BASE = "https://infindadigital.space";

export function getPublicBaseUrl(): string {
  const envBase = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isPreview = host.includes("id-preview--") || host === "localhost" || host.startsWith("127.");
    if (!isPreview) return window.location.origin;
  }
  return FALLBACK_PUBLIC_BASE;
}

export function buildPublicUrl(token: string): string {
  return `${getPublicBaseUrl()}/proposta/${token}`;
}