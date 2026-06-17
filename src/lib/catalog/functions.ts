import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CatalogItem } from "./types";

type ItemMutationInput = Record<string, unknown>;

const RawItemInput = z.record(z.string(), z.unknown());
const UpdateInput = z.object({ id: z.string().uuid(), patch: RawItemInput });
const ToggleInput = z.object({ id: z.string().uuid(), ativo: z.boolean() });

const tipos = ["servico", "pacote", "complemento", "bonus"] as const;
const complexidades = ["baixa", "media", "alta"] as const;
const areas = ["comercial", "marketing", "desenvolvimento", "design", "ia", "suporte", "outros"] as const;
const cobrancas = ["implantacao", "mensal", "avulso"] as const;

function cleanNullableString(value: unknown): string | null {
  if (typeof value !== "string") return value == null ? null : String(value).trim() || null;
  return value.trim() || null;
}

function cleanNumber(value: unknown, fallback = 0): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

function cleanOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function cleanEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeDbError(error: unknown): Error {
  const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
  const msg = [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(" · ") || String(error);
  if (/duplicate key|unique constraint.*catalog_items.*codigo|catalog_items_codigo_key/i.test(msg)) {
    return new Error("Já existe um item com este Código/SKU. Altere o código interno e tente novamente.");
  }
  return new Error(msg);
}

async function getAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.OWN_SB_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.OWN_SB_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuração do banco externo ausente no servidor.");
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function buildItemPayload(input: ItemMutationInput, createdBy?: string | null) {
  return {
    tipo: cleanEnum(input.tipo, tipos, "servico"),
    codigo: cleanNullableString(input.codigo),
    nome_comercial: cleanNullableString(input.nome_comercial),
    nome_interno: cleanNullableString(input.nome_interno),
    categoria_id: cleanNullableString(input.categoria_id),
    subcategoria: cleanNullableString(input.subcategoria),
    descricao_curta: cleanNullableString(input.descricao_curta),
    descricao_completa: cleanNullableString(input.descricao_completa),
    beneficios: cleanStringArray(input.beneficios),
    entregaveis: cleanStringArray(input.entregaveis),
    nao_incluso: cleanStringArray(input.nao_incluso),
    prazo_estimado_dias: cleanOptionalNumber(input.prazo_estimado_dias),
    complexidade: cleanEnum(input.complexidade, complexidades, "media"),
    prioridade: cleanNumber(input.prioridade),
    area_responsavel: cleanEnum(input.area_responsavel, areas, "comercial"),
    tempo_execucao_horas: cleanOptionalNumber(input.tempo_execucao_horas),
    objetivo: cleanNullableString(input.objetivo),
    cobranca: cleanEnum(input.cobranca, cobrancas, "implantacao"),
    valor_implantacao: cleanNumber(input.valor_implantacao),
    valor_mensal: cleanNumber(input.valor_mensal),
    valor_avulso: cleanNumber(input.valor_avulso),
    ativo: typeof input.ativo === "boolean" ? input.ativo : true,
    ordem: cleanNumber(input.ordem),
    tags: cleanStringArray(input.tags),
    observacoes_internas: cleanNullableString(input.observacoes_internas),
    ...(createdBy !== undefined ? { created_by: createdBy } : {}),
  };
}

export const createCatalogItemMutation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RawItemInput.parse(data))
  .handler(async ({ data, context }) => {
    const userId = (context as { userId?: string }).userId;
    if (!userId) throw new Error("Sessão expirada. Entre novamente para salvar no Catálogo.");
    const payload = buildItemPayload(data, userId);
    if (!payload.nome_comercial) throw new Error("Informe o nome comercial");
    const admin = await getAdmin();
    const { data: row, error } = await admin.from("catalog_items").insert(payload).select().single();
    if (error) throw normalizeDbError(error);
    return row as CatalogItem;
  });

export const updateCatalogItemMutation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateInput.parse(data))
  .handler(async ({ data }) => {
    const payload = buildItemPayload(data.patch);
    if (!payload.nome_comercial) throw new Error("Informe o nome comercial");
    const admin = await getAdmin();
    const { data: row, error } = await admin.from("catalog_items").update(payload).eq("id", data.id).select().maybeSingle();
    if (error) throw normalizeDbError(error);
    if (!row) throw new Error("Item não encontrado para edição.");
    return row as CatalogItem;
  });

export const toggleCatalogItemMutation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ToggleInput.parse(data))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const { error } = await admin.from("catalog_items").update({ ativo: data.ativo }).eq("id", data.id);
    if (error) throw normalizeDbError(error);
    return { ok: true };
  });