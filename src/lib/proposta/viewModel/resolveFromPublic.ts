import type { PublicProposal, ProposalContent } from "@/lib/propostas/types";
import { daysUntil, parcelasSugeridas } from "./money";
import {
  buildFallbackBeneficios,
  buildFallbackCases,
  buildFallbackDiagnostico,
  buildFallbackPorqueInfinda,
  buildFallbackProximosPassos,
  buildFallbackROI,
  buildFallbackSolucao,
  buildFallbackTimeline,
} from "./fallbackContent";
import type {
  ContentSource,
  ProposalViewModel,
  RenderMode,
  VMBeneficio,
  VMCase,
  VMItem,
  VMTimelineEntrega,
} from "./types";

/**
 * Conteúdo IA estendido — schema novo. Campos opcionais para tolerar
 * propostas antigas; ausentes caem no fallback determinístico.
 */
export interface AIContentV2 extends ProposalContent {
  riscos_atuais?: string[];
  oportunidades_perdidas?: string[];
  diferenciais_competitivos?: string[];
  ganhos_esperados?: string[];
  beneficios?: { titulo: string; descricao: string; icone?: string }[];
  porque_infinda?: string[];
  proximos_passos?: string[];
  cases?: { cliente: string; segmento?: string; desafio: string; resultado: string }[];
  timeline?: { semana: string; titulo: string; entregas: string[] }[];
  roi?: {
    economia?: number | null;
    economia_estimada?: number | null;
    faturamento_adicional?: number | null;
    payback_meses?: number | null;
    premissas?: string[];
  };
  meta?: { source?: ContentSource; generated_at?: string };
}

const isNonEmpty = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;
const arr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v.filter(Boolean) : []);

export interface ResolveOptions {
  mode: RenderMode;
  publicUrl?: string | null;
  /** Decisões já registradas (para marcar status do item no modo público). */
  itemDecisions?: Record<string, "aceito" | "recusado" | "pendente">;
  /** Estado de resolução das decisões — evita "estado parcial silencioso". */
  itemDecisionsState?: "complete" | "partial" | "missing";
  /** Anexos visíveis (para o cliente). */
  anexos?: ProposalViewModel["anexos"];
}

export function resolveFromPublic(
  raw: PublicProposal,
  opts: ResolveOptions,
): ProposalViewModel {
  const content = (raw.versao?.conteudo_json as AIContentV2 | undefined) ?? {};
  const cliente = raw.cliente ?? {};
  const lead = raw.lead ?? {};

  const segmento = cliente.segment ?? lead.segment ?? null;
  const cidade = cliente.city ?? null;
  const clienteNome = cliente.company ?? lead.company ?? "Cliente";
  const ownerNome = lead.owner ?? null;

  const fallbackCtx = {
    segmento,
    cidade,
    cliente: clienteNome,
    itensNomes: raw.items.map((i) => i.nome),
    observacoesVendedor: content.observacoes ?? null,
  };

  // ----- Diagnóstico -----
  const fbDiag = buildFallbackDiagnostico(fallbackCtx);
  const diagnostico = {
    texto: isNonEmpty(content.diagnostico) ? content.diagnostico! : fbDiag.texto,
    riscosAtuais: arr(content.riscos_atuais).length ? arr(content.riscos_atuais) : fbDiag.riscosAtuais,
    oportunidadesPerdidas: arr(content.oportunidades_perdidas).length
      ? arr(content.oportunidades_perdidas)
      : fbDiag.oportunidadesPerdidas,
  };

  // ----- Solução -----
  const fbSol = buildFallbackSolucao(fallbackCtx);
  const solucao = {
    problemas: arr(content.problemas).length ? arr(content.problemas) : fbSol.problemas,
    solucao: isNonEmpty(content.solucao) ? content.solucao! : fbSol.solucao,
    diferenciaisCompetitivos: arr(content.diferenciais_competitivos).length
      ? arr(content.diferenciais_competitivos)
      : fbSol.diferenciaisCompetitivos,
    ganhosEsperados: arr(content.ganhos_esperados).length ? arr(content.ganhos_esperados) : fbSol.ganhosEsperados,
  };

  // ----- Benefícios -----
  const beneficios: VMBeneficio[] = content.beneficios?.length
    ? content.beneficios.map((b) => ({ titulo: b.titulo, descricao: b.descricao, icone: b.icone }))
    : buildFallbackBeneficios();

  // ----- ROI -----
  const fbRoi = buildFallbackROI();
  const roi = {
    economiaEstimada: content.roi?.economia_estimada ?? content.roi?.economia ?? fbRoi.economiaEstimada,
    faturamentoAdicional: content.roi?.faturamento_adicional ?? fbRoi.faturamentoAdicional,
    paybackMeses: content.roi?.payback_meses ?? fbRoi.paybackMeses,
    premissas: arr(content.roi?.premissas).length ? arr(content.roi?.premissas) : fbRoi.premissas,
  };

  // ----- Timeline -----
  const timeline: VMTimelineEntrega[] = content.timeline?.length
    ? content.timeline.map((t) => ({ semana: t.semana, titulo: t.titulo, entregas: arr(t.entregas) }))
    : buildFallbackTimeline();

  // ----- Cases -----
  const cases: VMCase[] = content.cases?.length
    ? content.cases.map((c) => ({
        cliente: c.cliente,
        segmento: c.segmento ?? segmento,
        desafio: c.desafio,
        resultado: c.resultado,
      }))
    : buildFallbackCases(fallbackCtx);

  // ----- Itens + decisões -----
  const itens: VMItem[] = raw.items.map((it) => ({
    id: it.id,
    nome: it.nome,
    descricao: it.descricao,
    categoria: it.categoria,
    cobranca: it.cobranca,
    quantidade: it.quantidade,
    valorUnitario: it.valor_unitario,
    valorTotal: it.valor_total,
    prazoDias: it.prazo_dias,
    entregaveis: it.entregaveis,
    obrigatorio: false,
    decisao: opts.itemDecisions?.[it.id] ?? "pendente",
  }));

  // ----- Pacotes (derivados quando há > 1 categoria) -----
  const pacotes = buildPacotesFromItens(itens);

  // ----- Investimento -----
  const total12m = raw.valor_implantacao + raw.valor_mensal * 12 + raw.valor_avulso;
  const investimento = {
    implantacao: raw.valor_implantacao,
    mensal: raw.valor_mensal,
    avulso: raw.valor_avulso,
    total12m,
    parcelasSugeridas: parcelasSugeridas(raw.valor_implantacao + raw.valor_avulso, raw.valor_mensal),
    descontoAplicado: 0,
  };

  // ----- Header -----
  const dias = daysUntil(raw.valid_until);
  const expirada = raw.status === "expirada" || (dias !== null && dias < 0);

  // ----- Capabilities por modo -----
  const isInteractive = opts.mode === "web" || opts.mode === "portal";
  const podeDecidir = isInteractive && !expirada && ["enviada", "visualizada", "ajustes_solicitados"].includes(raw.status);

  return {
    id: raw.id,
    header: {
      numero: raw.numero,
      titulo: raw.titulo,
      status: raw.status,
      validadeAte: raw.valid_until,
      diasRestantes: dias,
      expirada,
      cliente: {
        nome: clienteNome,
        contato: cliente.contact_name ?? null,
        segmento,
        cidade,
        estado: cliente.state ?? null,
      },
      owner: ownerNome ? { nome: ownerNome, papel: "owner" } : null,
    },
    diagnostico,
    solucao,
    beneficios,
    porqueInfinda: arr(content.porque_infinda).length ? arr(content.porque_infinda) : buildFallbackPorqueInfinda(),
    roi,
    pacotes,
    itens,
    investimento,
    timeline,
    cases,
    proximosPassos: arr(content.proximos_passos).length ? arr(content.proximos_passos) : buildFallbackProximosPassos(),
    observacoes: isNonEmpty(content.observacoes) ? content.observacoes! : null,
    anexos: opts.anexos ?? [],
    capabilities: {
      canApproveProposal: podeDecidir,
      canApproveItems: podeDecidir && itens.length > 1,
      canRequestAdjustment: podeDecidir,
      canReject: podeDecidir,
      canDownloadPdf: opts.mode !== "email",
      canViewInternalNotes: false,
      showStickyCTA: opts.mode === "web" || opts.mode === "portal",
      mode: opts.mode,
    },
    meta: {
      source: content.meta?.source ?? "ai",
      generatedAt: content.meta?.generated_at ?? null,
      publicUrl: opts.publicUrl ?? null,
      versionNumber: raw.versao?.version_number ?? null,
    },
    itemDecisionsState: opts.itemDecisionsState ?? (opts.itemDecisions ? "complete" : "missing"),
  };
}

/**
 * Quando há mais de uma categoria comercial entre os itens, agrupa em
 * pacotes (Essencial / Recomendado / Completo). Sem mais de uma categoria,
 * retorna um único pacote.
 */
function buildPacotesFromItens(itens: VMItem[]): ProposalViewModel["pacotes"] {
  if (itens.length <= 1) return [];

  const categorias = Array.from(new Set(itens.map((i) => i.categoria ?? "geral")));
  if (categorias.length === 1) return [];

  // Estratégia: ordena por valor crescente e cria 3 pacotes incrementais.
  const ordenados = [...itens].sort((a, b) => a.valorTotal - b.valorTotal);
  const corte1 = Math.max(1, Math.ceil(ordenados.length / 3));
  const corte2 = Math.max(2, Math.ceil((ordenados.length * 2) / 3));

  const buckets: { nome: string; recomendado: boolean; itens: VMItem[] }[] = [
    { nome: "Essencial", recomendado: false, itens: ordenados.slice(0, corte1) },
    { nome: "Recomendado", recomendado: true, itens: ordenados.slice(0, corte2) },
    { nome: "Completo", recomendado: false, itens: ordenados },
  ];

  return buckets.map((b, idx) => {
    const totals = b.itens.reduce(
      (acc, it) => {
        if (it.cobranca === "implantacao") acc.imp += it.valorTotal;
        if (it.cobranca === "mensal") acc.men += it.valorTotal;
        if (it.cobranca === "avulso") acc.avu += it.valorTotal;
        return acc;
      },
      { imp: 0, men: 0, avu: 0 },
    );
    return {
      id: `pkg-${idx}`,
      nome: b.nome,
      recomendado: b.recomendado,
      itens: b.itens,
      totalImplantacao: totals.imp,
      totalMensal: totals.men,
      totalAvulso: totals.avu,
    };
  });
}