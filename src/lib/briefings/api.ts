import { supabase } from "@/integrations/supabase/client";
import type { Briefing, BriefingServico, BriefingStatus } from "./types";

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
}

export async function createBriefing(input: CreateBriefingInput): Promise<Briefing> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sessão necessária.");
  const row = {
    user_id: auth.user.id,
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

export async function listBriefings(): Promise<Briefing[]> {
  const { data, error } = await db
    .from("briefings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Briefing[];
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
  cliente_nome: string | null;
  empresa: string | null;
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