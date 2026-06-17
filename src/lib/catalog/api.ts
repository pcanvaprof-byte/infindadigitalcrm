import { supabase } from "@/integrations/supabase/client";
import type {
  CatalogCategoria,
  CatalogItem,
  CatalogArea,
  CatalogTipo,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function normalize(error: unknown): Error {
  const e = error as { message?: string; details?: string; hint?: string; code?: string } | null;
  const parts = [e?.message, e?.details, e?.hint, e?.code].filter(Boolean).join(" · ");
  const msg = parts || (error instanceof Error ? error.message : String(error));
  if (/catalog_items|catalog_categorias|relation .* does not exist|schema cache/i.test(msg)) {
    return new Error(
      `Backend sem a migration do Catálogo. Rode scripts/migrations/20260622_catalog_comercial.sql no SQL Editor do Supabase. Detalhe: ${msg}`,
    );
  }
  return error instanceof Error ? error : new Error(msg);
}

function withItemDefaults(row: unknown): CatalogItem {
  const r = row as Partial<CatalogItem>;
  return {
    ...r,
    beneficios: r.beneficios ?? [],
    entregaveis: r.entregaveis ?? [],
    nao_incluso: r.nao_incluso ?? [],
    tags: r.tags ?? [],
    valor_implantacao: Number(r.valor_implantacao ?? 0),
    valor_mensal: Number(r.valor_mensal ?? 0),
    valor_avulso: Number(r.valor_avulso ?? 0),
    prioridade: Number(r.prioridade ?? 0),
    ordem: Number(r.ordem ?? 0),
  } as CatalogItem;
}

// -------- Categorias --------
export async function listCategorias(): Promise<CatalogCategoria[]> {
  const { data, error } = await db
    .from("catalog_categorias")
    .select("*")
    .order("ordem", { ascending: true });
  if (error) throw normalize(error);
  return (data ?? []) as CatalogCategoria[];
}

// -------- Items --------
export interface ListItemsFilters {
  search?: string;
  categoriaId?: string | null;
  tipo?: CatalogTipo | null;
  area?: CatalogArea | null;
  apenasAtivos?: boolean;
}

export async function listItems(filters: ListItemsFilters = {}): Promise<CatalogItem[]> {
  let q = db.from("catalog_items").select("*");
  if (filters.categoriaId) q = q.eq("categoria_id", filters.categoriaId);
  if (filters.tipo) q = q.eq("tipo", filters.tipo);
  if (filters.area) q = q.eq("area_responsavel", filters.area);
  if (filters.apenasAtivos) q = q.eq("ativo", true);
  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim().replace(/[%_]/g, "");
    q = q.or(`nome_comercial.ilike.%${s}%,nome_interno.ilike.%${s}%,codigo.ilike.%${s}%`);
  }
  q = q.order("ordem", { ascending: true }).order("nome_comercial", { ascending: true });
  const { data, error } = await q;
  if (error) throw normalize(error);
  return ((data ?? []) as unknown[]).map(withItemDefaults);
}

export async function getItem(id: string): Promise<CatalogItem | null> {
  const { data, error } = await db.from("catalog_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalize(error);
  return data ? withItemDefaults(data) : null;
}

export type CatalogItemInput = Omit<
  CatalogItem,
  "id" | "created_at" | "updated_at" | "created_by"
>;

export async function createItem(input: Partial<CatalogItemInput>): Promise<CatalogItem> {
  const { data: auth } = await supabase.auth.getUser();
  const payload = {
    ...input,
    created_by: auth.user?.id ?? null,
  };
  const { data, error } = await db.from("catalog_items").insert(payload).select().single();
  if (error) throw normalize(error);
  return withItemDefaults(data);
}

export async function updateItem(id: string, patch: Partial<CatalogItemInput>): Promise<CatalogItem> {
  const { data, error } = await db.from("catalog_items").update(patch).eq("id", id).select().single();
  if (error) throw normalize(error);
  return withItemDefaults(data);
}

export async function toggleAtivo(id: string, ativo: boolean): Promise<void> {
  const { error } = await db.from("catalog_items").update({ ativo }).eq("id", id);
  if (error) throw normalize(error);
}

export async function duplicateItem(id: string): Promise<CatalogItem> {
  const orig = await getItem(id);
  if (!orig) throw new Error("Item não encontrado");
  const copy: Partial<CatalogItemInput> = {
    tipo: orig.tipo,
    codigo: orig.codigo ? `${orig.codigo}-COPY` : null,
    nome_comercial: `${orig.nome_comercial} (cópia)`,
    nome_interno: orig.nome_interno,
    categoria_id: orig.categoria_id,
    subcategoria: orig.subcategoria,
    descricao_curta: orig.descricao_curta,
    descricao_completa: orig.descricao_completa,
    beneficios: orig.beneficios,
    entregaveis: orig.entregaveis,
    nao_incluso: orig.nao_incluso,
    prazo_estimado_dias: orig.prazo_estimado_dias,
    complexidade: orig.complexidade,
    prioridade: orig.prioridade,
    area_responsavel: orig.area_responsavel,
    tempo_execucao_horas: orig.tempo_execucao_horas,
    objetivo: orig.objetivo,
    cobranca: orig.cobranca,
    valor_implantacao: orig.valor_implantacao,
    valor_mensal: orig.valor_mensal,
    valor_avulso: orig.valor_avulso,
    ativo: false, // cópia nasce inativa
    ordem: orig.ordem,
    tags: orig.tags,
    observacoes_internas: orig.observacoes_internas,
  };
  return createItem(copy);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await db.from("catalog_items").delete().eq("id", id);
  if (error) throw normalize(error);
}

// -------- Stats --------
export interface CatalogStats {
  total: number;
  ativos: number;
  inativos: number;
  categorias: number;
  ticketMedio: number;
  porTipo: Record<CatalogTipo, number>;
}

export function computeStats(items: CatalogItem[], categorias: CatalogCategoria[]): CatalogStats {
  const ativos = items.filter((i) => i.ativo);
  const valores = ativos.map((i) => {
    if (i.cobranca === "mensal") return i.valor_mensal;
    if (i.cobranca === "avulso") return i.valor_avulso;
    return i.valor_implantacao;
  });
  const soma = valores.reduce((a, b) => a + b, 0);
  const ticketMedio = valores.length ? soma / valores.length : 0;
  const porTipo: Record<CatalogTipo, number> = {
    servico: 0,
    pacote: 0,
    complemento: 0,
    bonus: 0,
  };
  for (const i of items) porTipo[i.tipo] = (porTipo[i.tipo] ?? 0) + 1;
  return {
    total: items.length,
    ativos: ativos.length,
    inativos: items.length - ativos.length,
    categorias: categorias.length,
    ticketMedio,
    porTipo,
  };
}