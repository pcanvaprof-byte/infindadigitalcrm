// Wrapper de acesso a `public.cad_niche_templates` — a tabela e as
// funções (`cad_niche_template_save`, `_reset`, `_restore_version`)
// ainda não estão nos tipos gerados; usamos casts `as never` para
// manter TypeScript feliz sem regenerar o schema aqui.

import { supabase } from "@/integrations/supabase/client";
import type { NicheKey } from "./niche-templates";

export type NicheTemplateRow = {
  id: string;
  niche_key: NicheKey;
  corpo: string;
  version: number;
  is_current: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "cad_niche_templates" as never;

/**
 * Lista o corpo da ABERTURA (Follow-up 1) de cada pack de nicho editado
 * pela organização ativa. Usado pela Prospecção como fallback para a
 * mensagem de primeiro contato.
 *
 * Fonte de verdade unificada: `cad_templates` com `pack_key = 'niche_<key>'`
 * (editado em /cadencia > Templates).
 */
export async function listCurrentNicheTemplates(): Promise<NicheTemplateRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from("cad_templates")
    .select("id, pack_key, corpo, updated_at")
    .like("pack_key", "niche_%")
    .eq("stage", "followup_1");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; pack_key: string; corpo: string; updated_at: string }>;
  return rows.map((r) => ({
    id: r.id,
    niche_key: r.pack_key.replace(/^niche_/, "") as NicheKey,
    corpo: r.corpo ?? "",
    version: 1,
    is_current: true,
    created_by: null,
    created_at: r.updated_at,
    updated_at: r.updated_at,
  }));
}

/** Histórico completo (todas as versões) para um nicho. */
export async function listNicheTemplateVersions(
  nicheKey: NicheKey,
): Promise<NicheTemplateRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, niche_key, corpo, version, is_current, created_by, created_at, updated_at")
    .eq("niche_key", nicheKey)
    .order("version", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as NicheTemplateRow[];
}

/** Salva uma nova versão corrente (arquiva a anterior). */
export async function saveNicheTemplate(nicheKey: NicheKey, corpo: string): Promise<string> {
  const { data, error } = await supabase.rpc(
    "cad_niche_template_save" as never,
    { _niche_key: nicheKey, _corpo: corpo } as never,
  );
  if (error) throw error;
  return (data as unknown as string) ?? "";
}

/** Restaura o padrão do código (remove todas as versões da org+nicho). */
export async function resetNicheTemplate(nicheKey: NicheKey): Promise<number> {
  const { data, error } = await supabase.rpc(
    "cad_niche_template_reset" as never,
    { _niche_key: nicheKey } as never,
  );
  if (error) throw error;
  return (data as unknown as number) ?? 0;
}

/** Reativa uma versão histórica como corrente (cria uma nova entrada). */
export async function restoreNicheTemplateVersion(versionId: string): Promise<string> {
  const { data, error } = await supabase.rpc(
    "cad_niche_template_restore_version" as never,
    { _version_id: versionId } as never,
  );
  if (error) throw error;
  return (data as unknown as string) ?? "";
}

/** Chaves de cache para React Query. */
export const nicheTemplateKeys = {
  all: ["niche-templates"] as const,
  current: () => [...nicheTemplateKeys.all, "current"] as const,
  versions: (nicheKey: NicheKey) => [...nicheTemplateKeys.all, "versions", nicheKey] as const,
};

/** Converte a lista de correntes num Map<niche_key, corpo> para o picker. */
export function toOverridesMap(rows: NicheTemplateRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    if (r.is_current && r.corpo) m.set(r.niche_key, r.corpo);
  }
  return m;
}
