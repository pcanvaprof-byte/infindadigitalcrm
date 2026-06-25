import { supabase } from "@/integrations/supabase/client";
import type {
  OpCliente,
  OpEntrega,
  OpEntregaStatus,
  OpTrafegoCampanha,
  OpTrafegoConta,
} from "./types";

// Tabelas op_* ainda não estão no schema gerado; cast para acesso simples.
const db = supabase as unknown as {
  from: (t: string) => any;
};

// ---------- Clientes -------------------------------------------------------
export async function listClientes(): Promise<OpCliente[]> {
  const { data, error } = await db.from("op_clientes").select("*").order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as OpCliente[];
}

export async function upsertCliente(
  input: Partial<OpCliente> & { nome: string },
): Promise<OpCliente> {
  const payload: Record<string, unknown> = {
    nome: input.nome.trim(),
    empresa: input.empresa?.toString().trim() || null,
    email: input.email?.toString().trim() || null,
    telefone: input.telefone?.toString().trim() || null,
    whatsapp: input.whatsapp?.toString().trim() || null,
    status: input.status ?? "ativo",
    observacoes: input.observacoes?.toString().trim() || null,
  };
  if (input.id) {
    const { data, error } = await db
      .from("op_clientes")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpCliente;
  }
  const { data, error } = await db.from("op_clientes").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as OpCliente;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await db.from("op_clientes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Importação a partir de Contratos -----------------------------
export type ImportContratoResult = {
  importados: number;
  ignorados: number;
  total: number;
};

function pickPessoa(p: Record<string, unknown> | null | undefined) {
  const x = (p ?? {}) as Record<string, unknown>;
  const nome =
    (x.razao_social as string) ||
    (x.nome_fantasia as string) ||
    (x.nome as string) ||
    (x.responsavel as string) ||
    "";
  const empresa = (x.nome_fantasia as string) || (x.razao_social as string) || "";
  const email = (x.email as string) || "";
  const telefone = (x.telefone as string) || "";
  const whatsapp = (x.whatsapp as string) || "";
  return { nome, empresa, email, telefone, whatsapp };
}

export async function importClientesFromContratos(): Promise<ImportContratoResult> {
  // status considerados "fechados" / ativos comerciais
  const statusFechados = ["assinado", "ativo", "pendente_financeiro"];
  const { data: contratos, error } = await db
    .from("contratos")
    .select("id, status, tipo_pessoa, dados_pessoa, valor_mensal, valor_implantacao")
    .in("status", statusFechados);
  if (error) throw new Error(error.message);
  const lista = (contratos ?? []) as Array<Record<string, unknown>>;

  const existentes = await listClientes();
  const idx = new Set(
    existentes.flatMap((c) => [
      (c.email ?? "").toLowerCase().trim(),
      (c.nome ?? "").toLowerCase().trim(),
      (c.empresa ?? "").toLowerCase().trim(),
    ].filter(Boolean)),
  );

  let importados = 0;
  let ignorados = 0;
  for (const c of lista) {
    const { nome, empresa, email, telefone, whatsapp } = pickPessoa(
      c.dados_pessoa as Record<string, unknown> | null,
    );
    if (!nome) {
      ignorados++;
      continue;
    }
    const chave = (email || nome || empresa).toLowerCase().trim();
    if (idx.has(chave)) {
      ignorados++;
      continue;
    }
    const obs = `Importado do contrato ${String(c.id).slice(0, 8)} · MRR ${Number(c.valor_mensal ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
    await upsertCliente({
      nome,
      empresa: empresa || undefined,
      email: email || undefined,
      telefone: telefone || undefined,
      whatsapp: whatsapp || undefined,
      status: "ativo",
      observacoes: obs,
    });
    idx.add(chave);
    importados++;
  }
  return { importados, ignorados, total: lista.length };
}

// ---------- Tráfego: contas ------------------------------------------------
export async function listContas(clienteId?: string): Promise<OpTrafegoConta[]> {
  let q = db.from("op_trafego_contas").select("*").order("created_at", { ascending: false });
  if (clienteId) q = q.eq("cliente_id", clienteId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OpTrafegoConta[];
}

export async function upsertConta(
  input: Partial<OpTrafegoConta> & { cliente_id: string; plataforma: OpTrafegoConta["plataforma"]; nome_conta: string },
): Promise<OpTrafegoConta> {
  const payload: Record<string, unknown> = {
    cliente_id: input.cliente_id,
    plataforma: input.plataforma,
    nome_conta: input.nome_conta.trim(),
    conta_id_externa: input.conta_id_externa?.toString().trim() || null,
    verba_mensal: Number(input.verba_mensal ?? 0) || 0,
    objetivo: input.objetivo?.toString().trim() || null,
    status: input.status ?? "ativa",
  };
  if (input.id) {
    const { data, error } = await db
      .from("op_trafego_contas")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpTrafegoConta;
  }
  const { data, error } = await db.from("op_trafego_contas").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as OpTrafegoConta;
}

export async function deleteConta(id: string): Promise<void> {
  const { error } = await db.from("op_trafego_contas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Tráfego: campanhas --------------------------------------------
export async function listCampanhas(clienteId?: string): Promise<OpTrafegoCampanha[]> {
  let q = db.from("op_trafego_campanhas").select("*").order("created_at", { ascending: false });
  if (clienteId) q = q.eq("cliente_id", clienteId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as OpTrafegoCampanha[];
}

export async function upsertCampanha(
  input: Partial<OpTrafegoCampanha> & { cliente_id: string; plataforma: OpTrafegoCampanha["plataforma"]; nome: string },
): Promise<OpTrafegoCampanha> {
  const payload: Record<string, unknown> = {
    cliente_id: input.cliente_id,
    conta_id: input.conta_id || null,
    plataforma: input.plataforma,
    nome: input.nome.trim(),
    status: input.status ?? "ativa",
    verba: Number(input.verba ?? 0) || 0,
    gasto: Number(input.gasto ?? 0) || 0,
    impressoes: Number(input.impressoes ?? 0) || 0,
    cliques: Number(input.cliques ?? 0) || 0,
    conversoes: Number(input.conversoes ?? 0) || 0,
    cpa: Number(input.cpa ?? 0) || 0,
    roas: Number(input.roas ?? 0) || 0,
    periodo_inicio: input.periodo_inicio || null,
    periodo_fim: input.periodo_fim || null,
  };
  if (input.id) {
    const { data, error } = await db
      .from("op_trafego_campanhas")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpTrafegoCampanha;
  }
  const { data, error } = await db
    .from("op_trafego_campanhas")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as OpTrafegoCampanha;
}

export async function deleteCampanha(id: string): Promise<void> {
  const { error } = await db.from("op_trafego_campanhas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Entregas (Kanban) ---------------------------------------------
export async function listEntregas(): Promise<OpEntrega[]> {
  const { data, error } = await db
    .from("op_entregas")
    .select("*")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OpEntrega[];
}

export async function upsertEntrega(
  input: Partial<OpEntrega> & { titulo: string },
): Promise<OpEntrega> {
  const payload: Record<string, unknown> = {
    cliente_id: input.cliente_id || null,
    titulo: input.titulo.trim(),
    tipo: input.tipo ?? "outro",
    status: input.status ?? "backlog",
    prazo: input.prazo || null,
    descricao: input.descricao?.toString().trim() || null,
    ordem: input.ordem ?? 0,
  };
  if (input.id) {
    const { data, error } = await db
      .from("op_entregas")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as OpEntrega;
  }
  const { data, error } = await db.from("op_entregas").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data as OpEntrega;
}

export async function updateEntregaStatus(id: string, status: OpEntregaStatus): Promise<void> {
  const { error } = await db.from("op_entregas").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEntrega(id: string): Promise<void> {
  const { error } = await db.from("op_entregas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Dashboard ------------------------------------------------------
export type OpDashboardMetrics = {
  clientesAtivos: number;
  clientesTotal: number;
  verbaMensal: number;
  gastoMes: number;
  roasMedio: number;
  entregasAtrasadas: number;
  entregasProximas: OpEntrega[];
  campanhasPausadas: OpTrafegoCampanha[];
};

export async function fetchDashboardMetrics(): Promise<OpDashboardMetrics> {
  const [clientes, campanhas, entregas] = await Promise.all([
    listClientes(),
    listCampanhas(),
    listEntregas(),
  ]);
  const ativos = clientes.filter((c) => c.status === "ativo");
  const verbaMensal = campanhas.reduce((acc, c) => acc + Number(c.verba || 0), 0);
  const gastoMes = campanhas.reduce((acc, c) => acc + Number(c.gasto || 0), 0);
  const roasValidos = campanhas.filter((c) => Number(c.roas) > 0);
  const roasMedio =
    roasValidos.length > 0
      ? roasValidos.reduce((acc, c) => acc + Number(c.roas), 0) / roasValidos.length
      : 0;
  const hoje = new Date().toISOString().slice(0, 10);
  const em7Dias = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const entregasAtrasadas = entregas.filter(
    (e) => e.status !== "entregue" && e.prazo && e.prazo < hoje,
  ).length;
  const entregasProximas = entregas
    .filter((e) => e.status !== "entregue" && e.prazo && e.prazo >= hoje && e.prazo <= em7Dias)
    .slice(0, 8);
  const campanhasPausadas = campanhas.filter((c) => c.status !== "ativa").slice(0, 6);
  return {
    clientesAtivos: ativos.length,
    clientesTotal: clientes.length,
    verbaMensal,
    gastoMes,
    roasMedio,
    entregasAtrasadas,
    entregasProximas,
    campanhasPausadas,
  };
}