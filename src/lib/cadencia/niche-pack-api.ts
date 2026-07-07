// API do pack de cadência por nicho.
// Cada nicho tem um pack "niche_<key>" (por organização) com as 7 etapas
// de follow-up. Quando o usuário não sobrescreveu uma etapa, ela é herdada
// do pack `default` do sistema (via RPC cad_niche_pack_stages).
import { supabase } from "@/integrations/supabase/client";
import type { CadStage } from "./types";

export type NichePackStage = {
  stage: CadStage;
  titulo: string;
  corpo: string;
  is_override: boolean;
};

const rpc = supabase as unknown as {
  rpc: (n: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** Lista as 7 etapas do pack do nicho, com merge (override da org → fallback default). */
export async function listNichePackStages(nicheKey: string): Promise<NichePackStage[]> {
  const { data, error } = await rpc.rpc("cad_niche_pack_stages", { _niche_key: nicheKey });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ stage: string; titulo: string; corpo: string; is_override: boolean }>;
  return rows.map((r) => ({
    stage: r.stage as CadStage,
    titulo: r.titulo ?? "",
    corpo: r.corpo ?? "",
    is_override: !!r.is_override,
  }));
}

/** Salva (upsert) uma etapa do pack do nicho para a org ativa. */
export async function upsertNichePackStage(input: {
  nicheKey: string;
  stage: CadStage;
  titulo: string;
  corpo: string;
}): Promise<string> {
  const { data, error } = await rpc.rpc("cad_niche_pack_upsert", {
    _niche_key: input.nicheKey,
    _stage: input.stage,
    _titulo: input.titulo,
    _corpo: input.corpo,
  });
  if (error) throw new Error(error.message);
  return (data as string) ?? "";
}

/** Reseta uma etapa (ou o pack inteiro, se stage=null) — remove overrides. */
export async function resetNichePackStage(nicheKey: string, stage: CadStage | null): Promise<number> {
  const { data, error } = await rpc.rpc("cad_niche_pack_reset", {
    _niche_key: nicheKey,
    _stage: stage,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Nichos com pelo menos uma etapa editada (para badge "editado" no sidebar). */
export async function listNichePackEditedKeys(): Promise<Map<string, number>> {
  const { data, error } = await rpc.rpc("cad_niche_pack_edited_keys");
  if (error) throw new Error(error.message);
  const map = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ niche_key: string; stages_edited: number }>) {
    map.set(r.niche_key, r.stages_edited);
  }
  return map;
}

export const nichePackKeys = {
  all: ["niche-packs"] as const,
  stages: (nicheKey: string) => ["niche-packs", "stages", nicheKey] as const,
  edited: () => ["niche-packs", "edited"] as const,
};