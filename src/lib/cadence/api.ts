import { supabase } from "@/integrations/supabase/client";
// Os tipos gerados (src/integrations/supabase/types.ts) ainda não conhecem
// as tabelas/RPCs da Fase 6 — a migration precisa ser executada e os tipos
// regerados. Até lá, usamos um cliente afrouxado APENAS para os novos pontos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

// ============================================================
// Cadência comercial — Fase 6
// Fonte única: tabela prospect_touchpoints + RPCs dashboard_metrics,
// acoes_hoje, snooze_prospect, close_cadence.
// Nenhum cálculo client-side de KPI.
// ============================================================

export type TouchpointTipo = "whatsapp" | "ligacao" | "email" | "reuniao" | "nota";
export type TouchpointResultado =
  | "enviado"
  | "respondido"
  | "interessado"
  | "sem_interesse"
  | "sem_resposta";

export type CadenceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type CadenceStatus = "ativo" | "pausado" | "encerrado";
export type ResponseStatus =
  | "sem_resposta"
  | "respondeu"
  | "interessado"
  | "sem_interesse"
  | "cliente";

export const CADENCE_STEP_LABEL: Record<CadenceStep, string> = {
  0: "Novo",
  1: "D+1",
  2: "D+3",
  3: "D+7",
  4: "D+15",
  5: "D+21",
  6: "Encerrado",
};

// Templates editáveis no front, mas o "step" é canônico (vem do banco).
export const CADENCE_TEMPLATES: Record<CadenceStep, string> = {
  0: "Olá! Sou {owner} da INFINDA. Identifiquei oportunidades específicas para a {company} e gostaria de conversar 5 minutos com você.",
  1: "Olá, tudo bem? Ontem tentei contato porque identifiquei oportunidades para sua empresa. Faz sentido conversarmos esta semana?",
  2: "Passando para reforçar minha mensagem anterior. Tenho algumas ideias que podem ajudar sua empresa. Vale uma conversa rápida?",
  3: "Imagino que a semana tenha sido corrida. Antes de encerrar meu contato, gostaria de saber se faz sentido conversarmos.",
  4: "Acredito que ainda posso contribuir com alguns insights para sua operação. Posso retornar mais adiante?",
  5: "Este será meu último contato por enquanto. Caso tenha interesse no futuro, fico à disposição.",
  6: "",
};

export interface Touchpoint {
  id: string;
  prospect_id: string;
  user_id: string;
  tipo: TouchpointTipo;
  mensagem: string | null;
  resultado: TouchpointResultado;
  enviado_em: string;
  created_at: string;
}

export interface AcaoHoje {
  id: string;
  company: string;
  whatsapp: string | null;
  cadence_step: CadenceStep;
  last_contact_at: string | null;
  next_contact_at: string | null;
  dias_atraso: number;
}

export interface DashboardMetrics {
  schema?: "v6" | "v5" | "v4" | "v2" | "legacy" | "empty";
  contatos:  { hoje: number; semana: number; mes: number; ultimos_7d: number };
  respostas: { hoje: number; semana: number; mes: number; ultimos_7d: number; taxa: number };
  resumo: {
    base: number;
    contatados: number;
    respondidos: number;
    novos: number;
    interessados: number;
    em_negociacao: number;
    ativos: number;
    perdidos: number;
  };
  pipeline: Partial<Record<
    "PROSPECCAO" | "CADENCIA" | "FECHADO" | "REUNIAO_INICIAL" | "PROPOSTA"
    | "CONTRATO" | "ASSINATURA" | "PAGAMENTO_CONFIRMADO" | "IMPLANTACAO"
    | "ATIVO" | "CHURNED" | "PERDIDO",
    number
  >>;
  gargalos: {
    cadencia_atrasada: number;
    parados_30d: number;
    sem_responsavel: number;
    clients_parados_15d: number;
    sem_proxima_acao: number;
  };
  conversao: {
    base_contato: number;
    contato_resposta: number;
    resposta_interesse: number;
    interesse_proposta: number;
    proposta_ativo: number;
  };
}

type ProspectMetricRow = {
  id: string;
  status: string | null;
  owner_name: string | null;
  cadence_status: string | null;
  last_contact_at: string | null;
  next_contact_at: string | null;
};

type TouchpointMetricRow = {
  prospect_id: string | null;
  tipo: string | null;
  resultado: string | null;
  enviado_em: string | null;
};

type ClientMetricRow = {
  id: string;
  pipeline_stage: string | null;
  updated_at: string | null;
  next_action_date: string | null;
  source_ref: string | null;
};

type CadLeadMetricRow = {
  id: string;
  prospect_id: string | null;
  stage: string | null;
  last_contact_at: string | null;
  next_action_at: string | null;
  last_response_at: string | null;
};

type CadMessageMetricRow = {
  lead_id: string | null;
  direction: string | null;
  tipo: string | null;
  status: string | null;
  created_at: string | null;
};

type OpClientMetricRow = {
  id: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MetricSource = "rpc" | "fallback";

let lastDashboardMetricSource: MetricSource = "rpc";

export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  schema: "empty",
  contatos: { hoje: 0, semana: 0, mes: 0, ultimos_7d: 0 },
  respostas: { hoje: 0, semana: 0, mes: 0, ultimos_7d: 0, taxa: 0 },
  resumo: {
    base: 0,
    contatados: 0,
    respondidos: 0,
    novos: 0,
    interessados: 0,
    em_negociacao: 0,
    ativos: 0,
    perdidos: 0,
  },
  pipeline: {},
  gargalos: {
    cadencia_atrasada: 0,
    parados_30d: 0,
    sem_responsavel: 0,
    clients_parados_15d: 0,
    sem_proxima_acao: 0,
  },
  conversao: {
    base_contato: 0,
    contato_resposta: 0,
    resposta_interesse: 0,
    interesse_proposta: 0,
    proposta_ativo: 0,
  },
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function n(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePipeline(value: unknown): DashboardMetrics["pipeline"] {
  const obj = asObject(value);
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, n(value)]),
  ) as DashboardMetrics["pipeline"];
}

function normalizeDashboardMetrics(value: unknown): DashboardMetrics {
  const data = asObject(value);
  const contatos = asObject(data.contatos);
  const respostas = asObject(data.respostas);
  const resumo = asObject(data.resumo);
  const gargalos = asObject(data.gargalos);
  const conversao = asObject(data.conversao);

  const hasV2Shape = Boolean(data.contatos && data.respostas && data.resumo);

  if (hasV2Shape) {
    return {
      schema: (data.schema as DashboardMetrics["schema"]) ?? "v2",
      contatos: {
        hoje: n(contatos.hoje),
        semana: n(contatos.semana),
        mes: n(contatos.mes),
        ultimos_7d: n(contatos.ultimos_7d ?? contatos.semana),
      },
      respostas: {
        hoje: n(respostas.hoje),
        semana: n(respostas.semana),
        mes: n(respostas.mes),
        ultimos_7d: n(respostas.ultimos_7d ?? respostas.semana),
        taxa: n(respostas.taxa),
      },
      resumo: {
        base: n(resumo.base),
        contatados: n(resumo.contatados),
        respondidos: n(resumo.respondidos),
        novos: n(resumo.novos),
        interessados: n(resumo.interessados),
        em_negociacao: n(resumo.em_negociacao),
        ativos: n(resumo.ativos),
        perdidos: n(resumo.perdidos),
      },
      pipeline: normalizePipeline(data.pipeline),
      gargalos: {
        cadencia_atrasada: n(gargalos.cadencia_atrasada),
        parados_30d: n(gargalos.parados_30d),
        sem_responsavel: n(gargalos.sem_responsavel),
        clients_parados_15d: n(gargalos.clients_parados_15d),
        sem_proxima_acao: n(gargalos.sem_proxima_acao),
      },
      conversao: {
        base_contato: n(conversao.base_contato),
        contato_resposta: n(conversao.contato_resposta),
        resposta_interesse: n(conversao.resposta_interesse),
        interesse_proposta: n(conversao.interesse_proposta),
        proposta_ativo: n(conversao.proposta_ativo),
      },
    };
  }

  // Compatibilidade: se a RPC antiga ainda estiver publicada no banco,
  // o dashboard não deve quebrar. Mapeamos o formato legado para o V2
  // até a migration 20260722_dashboard_metrics_v2.sql ser aplicada.
  const operacao = asObject(data.operacao);
  const cadencia = asObject(data.cadencia);

  return {
    ...EMPTY_DASHBOARD_METRICS,
    schema: Object.keys(data).length ? "legacy" : "empty",
    contatos: {
      hoje: n(cadencia.hoje),
      semana: n(cadencia.semana),
      mes: n(cadencia.mes),
      ultimos_7d: n(cadencia.semana),
    },
    respostas: {
      hoje: 0,
      semana: 0,
      mes: 0,
      ultimos_7d: 0,
      taxa: n(cadencia.taxa_resposta),
    },
    resumo: {
      base: n(operacao.base),
      contatados: n(operacao.contatadas),
      respondidos: n(asObject(data.filtros).responderam),
      novos: 0,
      interessados: n(operacao.interessadas),
      em_negociacao: 0,
      ativos: n(operacao.clientes),
      perdidos: 0,
    },
    gargalos: {
      cadencia_atrasada: n(gargalos.atrasados),
      parados_30d: n(gargalos.parados_30d),
      sem_responsavel: n(gargalos.sem_responsavel),
      clients_parados_15d: n(gargalos.deals_paradas_15d),
      sem_proxima_acao: 0,
    },
    conversao: {
      base_contato: n(conversao.base_contato),
      contato_resposta: n(conversao.contato_interesse),
      resposta_interesse: n(conversao.contato_interesse),
      interesse_proposta: n(conversao.reuniao_proposta),
      proposta_ativo: n(conversao.proposta_cliente),
    },
  };
}

function isDashboardRpcBroken(error: unknown): boolean {
  const maybe = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const text = [maybe?.code, maybe?.message, maybe?.details, maybe?.hint]
    .filter(Boolean)
    .map(String)
    .join(" ");
  return (
    text.includes("assert_pipeline_stages_mapped") ||
    text.includes("dashboard_metrics") ||
    text.includes("PGRST202") ||
    text.includes("42883") ||
    text.includes("Could not find") ||
    text.includes("does not exist") ||
    text.includes("schema cache")
  );
}

async function selectAllForMetrics<T>(table: string, columns: string): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) {
      console.warn(`[dashboard] fallback ignorou ${table}:`, error.message);
      return [];
    }
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function startOfDay(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d = new Date()): Date {
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const out = startOfDay(d);
  out.setDate(out.getDate() - diff);
  return out;
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isAtOrAfter(value: string | null | undefined, since: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= since.getTime();
}

function isBefore(value: string | null | undefined, before: Date): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time < before.getTime();
}

function pct(numerator: number, denominator: number, digits = 1): number {
  if (!denominator) return 0;
  const factor = 10 ** digits;
  return Math.round((numerator / denominator) * 100 * factor) / factor;
}

function countWhere<T>(rows: T[], predicate: (row: T) => boolean): number {
  return rows.reduce((acc, row) => acc + (predicate(row) ? 1 : 0), 0);
}

function maxBucket(...values: number[]): number {
  return Math.max(0, ...values.map((value) => Number(value) || 0));
}

function hasAnyActivity(bucket: { hoje: number; semana: number; mes: number; ultimos_7d: number }): boolean {
  return bucket.hoje > 0 || bucket.semana > 0 || bucket.mes > 0 || bucket.ultimos_7d > 0;
}

async function fetchDashboardMetricsFallback(): Promise<DashboardMetrics> {
  const [prospects, touchpoints, clients, cadLeads, cadMessages, opClients] = await Promise.all([
    selectAllForMetrics<ProspectMetricRow>(
      "prospects",
      "id,status,owner_name,cadence_status,last_contact_at,next_contact_at",
    ),
    selectAllForMetrics<TouchpointMetricRow>(
      "prospect_touchpoints",
      "prospect_id,tipo,resultado,enviado_em",
    ),
    selectAllForMetrics<ClientMetricRow>(
      "clients",
      "id,pipeline_stage,updated_at,next_action_date,source_ref",
    ),
    selectAllForMetrics<CadLeadMetricRow>(
      "cad_leads",
      "id,prospect_id,stage,last_contact_at,next_action_at,last_response_at",
    ),
    selectAllForMetrics<CadMessageMetricRow>(
      "cad_messages",
      "lead_id,direction,tipo,status,created_at",
    ),
    selectAllForMetrics<OpClientMetricRow>(
      "op_clientes",
      "id,status,created_at,updated_at",
    ),
  ]);

  const now = new Date();
  const day = startOfDay(now);
  const week = startOfWeek(now);
  const month = startOfMonth(now);
  const rolling7d = new Date(now.getTime() - 7 * 86400000);

  const leadToProspect = new Map(cadLeads.map((lead) => [lead.id, lead.prospect_id ?? lead.id]));
  const cadLeadProspectIds = new Set(cadLeads.map((lead) => lead.prospect_id ?? lead.id).filter(Boolean));
  const cadContactIds = new Set<string>();
  const cadResponseIds = new Set<string>();
  let cadContatosHoje = 0;
  let cadContatosSemana = 0;
  let cadContatosMes = 0;
  let cadContatos7d = 0;
  let cadRespostasHoje = 0;
  let cadRespostasSemana = 0;
  let cadRespostasMes = 0;
  let cadRespostas7d = 0;

  for (const msg of cadMessages) {
    const entityId = msg.lead_id ? leadToProspect.get(msg.lead_id) ?? msg.lead_id : null;
    if (!entityId) continue;
    const direction = String(msg.direction ?? "");
    const tipo = String(msg.tipo ?? "");
    const status = String(msg.status ?? "");
    const outbound = direction === "out" || (!direction && ["whatsapp", "email", "ligacao"].includes(tipo));
    const inbound = direction === "in" || status === "respondido";
    if (outbound) {
      cadContactIds.add(entityId);
      if (isAtOrAfter(msg.created_at, day)) cadContatosHoje++;
      if (isAtOrAfter(msg.created_at, week)) cadContatosSemana++;
      if (isAtOrAfter(msg.created_at, month)) cadContatosMes++;
      if (isAtOrAfter(msg.created_at, rolling7d)) cadContatos7d++;
    }
    if (inbound) {
      cadResponseIds.add(entityId);
      if (isAtOrAfter(msg.created_at, day)) cadRespostasHoje++;
      if (isAtOrAfter(msg.created_at, week)) cadRespostasSemana++;
      if (isAtOrAfter(msg.created_at, month)) cadRespostasMes++;
      if (isAtOrAfter(msg.created_at, rolling7d)) cadRespostas7d++;
    }
  }

  const touchContactIds = new Set<string>();
  const touchResponseIds = new Set<string>();
  let touchContatosHoje = 0;
  let touchContatosSemana = 0;
  let touchContatosMes = 0;
  let touchContatos7d = 0;
  let touchRespostasHoje = 0;
  let touchRespostasSemana = 0;
  let touchRespostasMes = 0;
  let touchRespostas7d = 0;

  for (const tp of touchpoints) {
    if (!tp.prospect_id) continue;
    // Se o prospect já está na Cadência, cad_messages é a fonte canônica.
    // Isso evita contar duas vezes o mesmo disparo (touchpoint + cad_message),
    // que era a causa dos 316 contatos contra 294 leads em cadência.
    if (cadLeadProspectIds.has(tp.prospect_id)) continue;
    const tipo = String(tp.tipo ?? "");
    const resultado = String(tp.resultado ?? "");
    const isContato = ["whatsapp", "ligacao", "email", "reuniao"].includes(tipo) && resultado !== "tentativa";
    const isResposta = tipo === "resposta" || ["respondido", "interessado"].includes(resultado);
    if (isContato) {
      touchContactIds.add(tp.prospect_id);
      if (isAtOrAfter(tp.enviado_em, day)) touchContatosHoje++;
      if (isAtOrAfter(tp.enviado_em, week)) touchContatosSemana++;
      if (isAtOrAfter(tp.enviado_em, month)) touchContatosMes++;
      if (isAtOrAfter(tp.enviado_em, rolling7d)) touchContatos7d++;
    }
    if (isResposta) {
      touchResponseIds.add(tp.prospect_id);
      if (isAtOrAfter(tp.enviado_em, day)) touchRespostasHoje++;
      if (isAtOrAfter(tp.enviado_em, week)) touchRespostasSemana++;
      if (isAtOrAfter(tp.enviado_em, month)) touchRespostasMes++;
      if (isAtOrAfter(tp.enviado_em, rolling7d)) touchRespostas7d++;
    }
  }

  const pipelineCounts = clients.reduce<Record<string, number>>((acc, row) => {
    const stage = row.pipeline_stage ?? "";
    if (stage) acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});

  const openStages = new Set([
    "PROSPECCAO", "CADENCIA", "FECHADO", "REUNIAO_INICIAL", "PROPOSTA",
    "CONTRATO", "ASSINATURA", "PAGAMENTO_CONFIRMADO", "IMPLANTACAO",
  ]);
  const advancedStages = new Set([
    "REUNIAO_INICIAL", "PROPOSTA", "CONTRATO", "ASSINATURA",
    "PAGAMENTO_CONFIRMADO", "IMPLANTACAO", "ATIVO",
  ]);

  const advancedIds = new Set<string>();
  for (const client of clients) {
    if (client.source_ref && advancedStages.has(String(client.pipeline_stage ?? ""))) {
      advancedIds.add(client.source_ref);
    }
  }

  const prospectStatus = (statuses: string[]) =>
    countWhere(prospects, (p) => statuses.includes(String(p.status ?? "")));
  const cadStage = (stages: string[]) =>
    countWhere(cadLeads, (lead) => stages.includes(String(lead.stage ?? "")));
  const clientStage = (stages: string[]) =>
    countWhere(clients, (client) => stages.includes(String(client.pipeline_stage ?? "")));

  const novos = maxBucket(
    clientStage(["PROSPECCAO", "CADENCIA", "FECHADO"]),
    prospectStatus(["", "novo", "nao_contatado", "primeiro_contato"]),
    cadStage(["followup_1", "followup_2", "followup_3", "followup_4", "followup_5", "followup_6", "followup_7"]),
  );
  const interessados = maxBucket(
    clientStage(["REUNIAO_INICIAL"]),
    prospectStatus(["qualificado", "briefing_enviado", "diagnostico_pendente", "agendado"]),
    cadStage(["interessado", "reuniao_agendada"]),
  );
  const emNegociacao = maxBucket(
    clientStage(["PROPOSTA", "CONTRATO", "ASSINATURA", "PAGAMENTO_CONFIRMADO", "IMPLANTACAO"]),
    prospectStatus(["em_negociacao", "proposta_pendente", "proposta_enviada"]),
    cadStage(["proposta_enviada", "negociacao"]),
  );
  const ativos = maxBucket(
    clientStage(["ATIVO"]),
    countWhere(opClients, (client) => String(client.status ?? "") === "ativo"),
    prospectStatus(["fechado_ganho", "cliente", "aguardando_kickoff", "aguardando_producao", "em_producao", "entregue"]),
    cadStage(["fechado"]),
  );
  const perdidos = maxBucket(
    clientStage(["PERDIDO", "CHURNED"]),
    prospectStatus(["perdido"]),
    cadStage(["perdido"]),
  );

  const cadActivity = {
    hoje: cadContatosHoje,
    semana: cadContatosSemana,
    mes: cadContatosMes,
    ultimos_7d: cadContatos7d,
  };
  const touchActivity = {
    hoje: touchContatosHoje,
    semana: touchContatosSemana,
    mes: touchContatosMes,
    ultimos_7d: touchContatos7d,
  };
  const responseCadActivity = {
    hoje: cadRespostasHoje,
    semana: cadRespostasSemana,
    mes: cadRespostasMes,
    ultimos_7d: cadRespostas7d,
  };
  const responseTouchActivity = {
    hoje: touchRespostasHoje,
    semana: touchRespostasSemana,
    mes: touchRespostasMes,
    ultimos_7d: touchRespostas7d,
  };

  const allContactIds = new Set([...cadContactIds, ...touchContactIds]);
  const allResponseIds = new Set([...cadResponseIds, ...touchResponseIds, ...advancedIds]);
  const base = maxBucket(prospects.length, cadLeads.length, clients.length, opClients.length);
  const contatados = allContactIds.size;
  const respondidos = allResponseIds.size;
  const emNegociacaoMaisAtivos = emNegociacao + ativos;
  const interesseMaisAvancados = interessados + emNegociacao + ativos;

  return {
    schema: "v6",
    contatos: {
      hoje: cadActivity.hoje + touchActivity.hoje,
      semana: cadActivity.semana + touchActivity.semana,
      mes: cadActivity.mes + touchActivity.mes,
      ultimos_7d: cadActivity.ultimos_7d + touchActivity.ultimos_7d,
    },
    respostas: {
      hoje: responseCadActivity.hoje + responseTouchActivity.hoje,
      semana: responseCadActivity.semana + responseTouchActivity.semana,
      mes: responseCadActivity.mes + responseTouchActivity.mes,
      ultimos_7d: responseCadActivity.ultimos_7d + responseTouchActivity.ultimos_7d,
      taxa: pct(respondidos, contatados),
    },
    resumo: {
      base,
      contatados,
      respondidos,
      novos,
      interessados,
      em_negociacao: emNegociacao,
      ativos,
      perdidos,
    },
    pipeline: pipelineCounts as DashboardMetrics["pipeline"],
    gargalos: {
      cadencia_atrasada: maxBucket(
        countWhere(prospects, (p) => p.cadence_status === "ativo" && isBefore(p.next_contact_at, now)),
        countWhere(cadLeads, (lead) => !["fechado", "perdido"].includes(String(lead.stage ?? "")) && isBefore(lead.next_action_at, now)),
      ),
      parados_30d: maxBucket(
        countWhere(prospects, (p) => isBefore(p.last_contact_at, new Date(now.getTime() - 30 * 86400000))),
        countWhere(cadLeads, (lead) => isBefore(lead.last_contact_at, new Date(now.getTime() - 30 * 86400000))),
      ),
      sem_responsavel: countWhere(prospects, (p) => !String(p.owner_name ?? "").trim()),
      clients_parados_15d: countWhere(
        clients,
        (client) => openStages.has(String(client.pipeline_stage ?? "")) && isBefore(client.updated_at, new Date(now.getTime() - 15 * 86400000)),
      ),
      sem_proxima_acao: countWhere(
        clients,
        (client) => openStages.has(String(client.pipeline_stage ?? "")) && !client.next_action_date,
      ),
    },
    conversao: {
      base_contato: pct(contatados, base),
      contato_resposta: pct(respondidos, contatados),
      resposta_interesse: pct(interesseMaisAvancados, respondidos),
      interesse_proposta: pct(emNegociacaoMaisAtivos, interesseMaisAvancados),
      proposta_ativo: pct(ativos, emNegociacaoMaisAtivos),
    },
  };
}

function preferRealValue(rpcValue: number, fallbackValue: number): number {
  return rpcValue > 0 ? rpcValue : fallbackValue;
}

function mergeDashboardMetrics(rpcMetrics: DashboardMetrics, fallbackMetrics: DashboardMetrics): DashboardMetrics {
  const useFallbackContacts = hasAnyActivity(fallbackMetrics.contatos);
  const useFallbackResponses = hasAnyActivity(fallbackMetrics.respostas);
  const contatos = useFallbackContacts ? fallbackMetrics.contatos : rpcMetrics.contatos;
  const respostas = {
    ...(useFallbackResponses ? fallbackMetrics.respostas : rpcMetrics.respostas),
  };
  const resumo = {
    base: preferRealValue(rpcMetrics.resumo.base, fallbackMetrics.resumo.base),
    contatados: preferRealValue(fallbackMetrics.resumo.contatados, rpcMetrics.resumo.contatados),
    respondidos: preferRealValue(fallbackMetrics.resumo.respondidos, rpcMetrics.resumo.respondidos),
    novos: preferRealValue(rpcMetrics.resumo.novos, fallbackMetrics.resumo.novos),
    interessados: preferRealValue(rpcMetrics.resumo.interessados, fallbackMetrics.resumo.interessados),
    em_negociacao: preferRealValue(rpcMetrics.resumo.em_negociacao, fallbackMetrics.resumo.em_negociacao),
    ativos: preferRealValue(rpcMetrics.resumo.ativos, fallbackMetrics.resumo.ativos),
    perdidos: preferRealValue(rpcMetrics.resumo.perdidos, fallbackMetrics.resumo.perdidos),
  };
  respostas.taxa = pct(resumo.respondidos, resumo.contatados);

  return {
    ...rpcMetrics,
    contatos,
    respostas,
    resumo,
    conversao: {
      base_contato: pct(resumo.contatados, resumo.base),
      contato_resposta: pct(resumo.respondidos, resumo.contatados),
      resposta_interesse: preferRealValue(fallbackMetrics.conversao.resposta_interesse, rpcMetrics.conversao.resposta_interesse),
      interesse_proposta: preferRealValue(fallbackMetrics.conversao.interesse_proposta, rpcMetrics.conversao.interesse_proposta),
      proposta_ativo: preferRealValue(fallbackMetrics.conversao.proposta_ativo, rpcMetrics.conversao.proposta_ativo),
    },
    gargalos: {
      cadencia_atrasada: preferRealValue(rpcMetrics.gargalos.cadencia_atrasada, fallbackMetrics.gargalos.cadencia_atrasada),
      parados_30d: preferRealValue(rpcMetrics.gargalos.parados_30d, fallbackMetrics.gargalos.parados_30d),
      sem_responsavel: preferRealValue(rpcMetrics.gargalos.sem_responsavel, fallbackMetrics.gargalos.sem_responsavel),
      clients_parados_15d: preferRealValue(rpcMetrics.gargalos.clients_parados_15d, fallbackMetrics.gargalos.clients_parados_15d),
      sem_proxima_acao: preferRealValue(rpcMetrics.gargalos.sem_proxima_acao, fallbackMetrics.gargalos.sem_proxima_acao),
    },
  };
}

export const cadenceKeys = {
  dashboard: ["cadence", "dashboard"] as const,
  acoesHoje: ["cadence", "acoes-hoje"] as const,
  timeline: (prospectId: string) => ["cadence", "timeline", prospectId] as const,
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Sessão expirada — entre novamente.");
  return id;
}

/** Lista touchpoints de um prospect (timeline). */
export async function listTouchpoints(prospectId: string): Promise<Touchpoint[]> {
  const { data, error } = await sb
    .from("prospect_touchpoints")
    .select("*")
    .eq("prospect_id", prospectId)
    // Eventos 'status' aparecem no histórico do card (p.interactions),
    // não na timeline da cadência — mantém a timeline limpa.
    .neq("tipo", "status")
    .order("enviado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Touchpoint[];
}

/** Insere touchpoint. Trigger no banco avança cadência + atualiza prospect. */
export async function addTouchpoint(input: {
  prospect_id: string;
  tipo: TouchpointTipo | "resposta";
  mensagem?: string | null;
  resultado: TouchpointResultado;
}): Promise<Touchpoint> {
  console.log("[cadence-api] addTouchpoint:start", input);
  const user_id = await uid();
  const { data, error } = await sb
    .from("prospect_touchpoints")
    .insert({
      prospect_id: input.prospect_id,
      user_id,
      tipo: input.tipo,
      mensagem: input.mensagem ?? null,
      resultado: input.resultado,
    })
    .select()
    .single();
  if (error) {
    console.error("[cadence-api] addTouchpoint:error", { input, error });
    throw error;
  }
  console.log("[cadence-api] addTouchpoint:ok", { id: (data as Touchpoint)?.id });
  return data as Touchpoint;
}

/**
 * Registra uma RESPOSTA inbound (cliente respondeu por wpp/ligação/email).
 * Conta na taxa de resposta do dashboard e marca o prospect como respondido,
 * mas NÃO avança a cadência (trigger trata).
 */
export async function registerResponse(
  prospectId: string,
  canal: "whatsapp" | "ligacao" | "email" | "outro" = "whatsapp",
  mensagem?: string,
): Promise<Touchpoint> {
  const user_id = await uid();
  const { data, error } = await sb
    .from("prospect_touchpoints")
    .insert({
      prospect_id: prospectId,
      user_id,
      tipo: "resposta",
      mensagem: mensagem ?? `Resposta recebida (${canal})`,
      resultado: "respondido",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Touchpoint;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await sb.rpc("dashboard_metrics");
  if (error) {
    if (isDashboardRpcBroken(error)) {
      lastDashboardMetricSource = "fallback";
      return fetchDashboardMetricsFallback();
    }
    throw error;
  }
  lastDashboardMetricSource = "rpc";
  const rpcMetrics = normalizeDashboardMetrics(data);
  const fallbackMetrics = await fetchDashboardMetricsFallback();
  return mergeDashboardMetrics(rpcMetrics, fallbackMetrics);
}

export function getLastDashboardMetricSource(): MetricSource {
  return lastDashboardMetricSource;
}

export async function fetchAcoesHoje(limit = 100): Promise<AcaoHoje[]> {
  const { data, error } = await sb.rpc("acoes_hoje", { _limit: limit });
  if (error) throw error;
  return (data ?? []) as AcaoHoje[];
}

export async function snoozeProspect(prospectId: string, days: number): Promise<string> {
  const { data, error } = await sb.rpc("snooze_prospect", {
    _prospect_id: prospectId,
    _days: days,
  });
  if (error) throw error;
  return data as unknown as string;
}

export type CloseReason =
  | "sem_interesse"
  | "numero_invalido"
  | "empresa_fechada"
  | "cliente"
  | "outro";

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  sem_interesse: "Sem interesse",
  numero_invalido: "Número inválido",
  empresa_fechada: "Empresa fechada",
  cliente: "Cliente fechado",
  outro: "Outro",
};

export async function closeCadence(
  prospectId: string,
  reason: CloseReason,
  note?: string,
): Promise<void> {
  const { error } = await sb.rpc("close_cadence", {
    _prospect_id: prospectId,
    _reason: reason,
    _note: note ?? null,
  });
  if (error) throw error;
}

// ----- helpers de UI ------------------------------------------------------

/** Próxima ação textual a partir do next_contact_at (timezone do navegador). */
export function proximaAcaoLabel(nextIso: string | null | undefined): {
  text: string;
  tone: "overdue" | "today" | "tomorrow" | "soon" | "later" | "none";
} {
  if (!nextIso) return { text: "—", tone: "none" };
  const next = new Date(nextIso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const diffDays = Math.round((nextDay.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays < 0) return { text: `Atrasado há ${-diffDays} dia${-diffDays > 1 ? "s" : ""}`, tone: "overdue" };
  if (diffDays === 0) return { text: "Hoje", tone: "today" };
  if (diffDays === 1) return { text: "Amanhã", tone: "tomorrow" };
  if (diffDays <= 7) return { text: `Em ${diffDays} dias`, tone: "soon" };
  return { text: `Em ${diffDays} dias`, tone: "later" };
}