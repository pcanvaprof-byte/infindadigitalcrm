import { supabase } from "@/integrations/supabase/client";
import type { Briefing, BriefingServico, BriefingStatus, BriefingTipo } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function generateToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CreateBriefingInput {
  cliente_nome: string;
  empresa?: string;
  telefone?: string;
  email?: string;
  servico: BriefingServico;
  responsavel?: string;
  tipo?: BriefingTipo;
  lead_id?: string | null;
}

export async function createBriefing(input: CreateBriefingInput): Promise<Briefing> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sessão necessária.");
  const tipo: BriefingTipo = input.tipo ?? "briefing_comercial";
  let leadId = input.lead_id ?? null;

  // Briefing Comercial sem lead vinculado → cria prospect automaticamente
  if (tipo === "briefing_comercial" && !leadId) {
    const { data: lead, error: leadErr } = await db
      .from("prospects")
      .insert({
        user_id: auth.user.id,
        company: input.empresa || input.cliente_nome,
        owner_name: input.cliente_nome,
        whatsapp: input.telefone ?? "",
        phone: input.telefone ?? "",
        email: input.email ?? "",
        segment: "Outros",
        source: "briefing",
        potential: "medio",
        status: "nao_contatado",
      })
      .select("id")
      .single();
    if (!leadErr && lead) leadId = lead.id as string;
  }

  const row = {
    user_id: auth.user.id,
    tipo,
    lead_id: leadId,
    cliente_nome: input.cliente_nome,
    empresa: input.empresa ?? null,
    telefone: input.telefone ?? null,
    email: input.email ?? null,
    servico: input.servico,
    responsavel: input.responsavel ?? null,
    token_publico: generateToken(),
    status: "pendente" as BriefingStatus,
    respostas_json: {},
  };
  const { data, error } = await db.from("briefings").insert(row).select().single();
  if (error) throw error;
  return data as Briefing;
}

export async function listBriefings(opts?: { tipo?: BriefingTipo }): Promise<Briefing[]> {
  let q = db
    .from("briefings")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts?.tipo) q = q.eq("tipo", opts.tipo);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Briefing[];
}

export interface KickoffElegivel {
  id: string;
  company: string;
  owner: string;
  email: string;
  phone: string;
}

/** Prospects com status `fechado_ganho` sem kickoff ainda. */
export async function listKickoffsElegiveis(): Promise<KickoffElegivel[]> {
  const { data: prospects, error } = await db
    .from("prospects")
    .select("id, company, owner_name, email, phone")
    .eq("status", "fechado_ganho")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const list = (prospects ?? []) as Array<{
    id: string; company: string; owner_name: string; email: string; phone: string;
  }>;
  if (!list.length) return [];
  const { data: existing } = await db
    .from("briefings")
    .select("lead_id")
    .eq("tipo", "kickoff_producao")
    .in("lead_id", list.map((p) => p.id));
  const used = new Set(((existing ?? []) as { lead_id: string | null }[]).map((r) => r.lead_id));
  return list
    .filter((p) => !used.has(p.id))
    .map((p) => ({
      id: p.id,
      company: p.company,
      owner: p.owner_name,
      email: p.email,
      phone: p.phone,
    }));
}

export async function getBriefingById(id: string): Promise<Briefing | null> {
  const { data, error } = await db.from("briefings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Briefing | null) ?? null;
}

export async function cancelBriefing(id: string): Promise<void> {
  const { error } = await db.from("briefings").update({ status: "cancelado" }).eq("id", id);
  if (error) throw error;
}

// === Acesso público (via token + RPC SECURITY DEFINER) ===

export interface PublicBriefing {
  id: string;
  tipo: BriefingTipo;
  lead_id: string | null;
  cliente_nome: string | null;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  servico: BriefingServico;
  status: BriefingStatus;
  respostas_json: Record<string, string>;
  token_publico: string;
  created_at: string;
  updated_at: string;
}

export async function getBriefingByToken(token: string): Promise<PublicBriefing | null> {
  const { data, error } = await db.rpc("get_briefing_by_token", { p_token: token });
  if (error) throw error;
  const rows = (data ?? []) as PublicBriefing[];
  return rows[0] ?? null;
}

export async function saveAnswersByToken(
  token: string,
  respostas: Record<string, string>,
  status?: "em_preenchimento" | "concluido",
): Promise<PublicBriefing | null> {
  const { data, error } = await db.rpc("update_briefing_by_token", {
    p_token: token,
    p_respostas: respostas,
    p_status: status ?? null,
  });
  if (error) throw error;
  return (data as PublicBriefing | null) ?? null;
}