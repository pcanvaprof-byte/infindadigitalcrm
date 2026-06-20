import { supabase } from "@/integrations/supabase/client";
import type {
  Contrato,
  ContratoEvento,
  ContratoKpis,
  ContratoStatus,
  AssinaturaTipo,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const contratosKeys = {
  all: ["contratos"] as const,
  one: (id: string) => ["contratos", id] as const,
  byProposal: (pid: string) => ["contratos", "by-proposal", pid] as const,
  events: (id: string) => ["contratos", id, "events"] as const,
  kpis: ["contratos", "kpis"] as const,
};

function num(v: unknown, d = 0): number {
  const n = Number(v ?? d);
  return Number.isFinite(n) ? n : d;
}

function norm(r: Record<string, unknown>): Contrato {
  return {
    ...(r as unknown as Contrato),
    valor_implantacao: num(r.valor_implantacao),
    valor_mensal: num(r.valor_mensal),
    valor_investimento_midia: r.valor_investimento_midia == null ? null : num(r.valor_investimento_midia),
    prazo_minimo_meses: num(r.prazo_minimo_meses, 3),
    dados_pessoa: (r.dados_pessoa as Contrato["dados_pessoa"]) ?? {},
    dados_bancarios: (r.dados_bancarios as Contrato["dados_bancarios"]) ?? {},
    escopo: (r.escopo as Contrato["escopo"]) ?? [],
    aceites: (r.aceites as Contrato["aceites"]) ?? {},
  };
}

export async function listContratos(): Promise<Contrato[]> {
  const { data, error } = await sb
    .from("contratos")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(norm);
}

export async function getContrato(id: string): Promise<Contrato | null> {
  const { data, error } = await sb.from("contratos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? norm(data) : null;
}

export async function getContratoByProposal(proposalId: string): Promise<Contrato | null> {
  const { data, error } = await sb
    .from("contratos")
    .select("*")
    .eq("proposal_id", proposalId)
    .maybeSingle();
  if (error) throw error;
  return data ? norm(data) : null;
}

export async function criarContratoFromProposta(proposalId: string): Promise<string> {
  const { data, error } = await sb.rpc("criar_contrato_from_proposta", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
  if (!data) throw new Error("Falha ao criar contrato");
  return data as string;
}

export async function updateContrato(id: string, patch: Partial<Contrato>): Promise<void> {
  const { error } = await sb.from("contratos").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setContratoStatus(id: string, status: ContratoStatus): Promise<void> {
  await updateContrato(id, { status } as Partial<Contrato>);
  await logEvento(id, `evt_status_${status}`);
}

export async function logEvento(
  contratoId: string,
  tipo: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await sb.from("contrato_eventos").insert({
    contrato_id: contratoId,
    tipo,
    payload,
    actor_type: "user",
  });
  if (error) throw error;
}

export async function listEventos(contratoId: string): Promise<ContratoEvento[]> {
  const { data, error } = await sb
    .from("contrato_eventos")
    .select("*")
    .eq("contrato_id", contratoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ContratoEvento[];
}

export async function finalizarContrato(input: {
  contratoId: string;
  tipo: AssinaturaTipo;
  payload: string;
  nome: string;
}): Promise<void> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
  const { error } = await sb.rpc("finalizar_contrato", {
    p_contrato_id: input.contratoId,
    p_assinatura_tipo: input.tipo,
    p_assinatura_payload: input.payload,
    p_assinatura_nome: input.nome,
    p_ip: null,
    p_ua: ua,
  });
  if (error) throw error;
}

export async function fetchContratoKpis(): Promise<ContratoKpis> {
  const { data, error } = await sb.from("vw_contratos_kpis").select("*").maybeSingle();
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    ativos: num(r.ativos),
    pendentes: num(r.pendentes),
    assinados: num(r.assinados),
    cancelados: num(r.cancelados),
    mrr: num(r.mrr),
    arr: num(r.arr),
    ticket_medio: num(r.ticket_medio),
  };
}