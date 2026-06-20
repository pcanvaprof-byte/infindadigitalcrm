import type {
  VMBeneficio,
  VMCase,
  VMDiagnostico,
  VMROI,
  VMSolucao,
  VMTimelineEntrega,
} from "./types";

interface FallbackContext {
  segmento: string | null;
  cidade: string | null;
  cliente: string;
  itensNomes: string[];
  observacoesVendedor: string | null;
}

/**
 * Conteúdo determinístico — usado quando IA falha 2x ou retorna campo vazio.
 * Não depende de IA. Não trava fluxo de venda. Marca source='fallback'.
 */
export function buildFallbackDiagnostico(ctx: FallbackContext): VMDiagnostico {
  const seg = ctx.segmento?.trim() || "seu segmento";
  const cidade = ctx.cidade ? ` em ${ctx.cidade}` : "";
  return {
    texto: `Empresas de ${seg}${cidade} enfrentam um cenário em que a presença digital deixou de ser diferencial e virou requisito mínimo de competitividade. ${ctx.cliente} está num momento decisivo para estruturar processos comerciais previsíveis e construir uma operação de marketing que gere demanda qualificada de forma recorrente.`,
    riscosAtuais: [
      "Dependência de indicação e canais orgânicos sem previsibilidade",
      "Concorrentes investindo em mídia paga e ganhando market share",
      "Marca pouco lembrada no momento da decisão de compra",
      "Vendas reativas em vez de processo comercial ativo",
    ],
    oportunidadesPerdidas: [
      "Leads que pesquisam soluções e fecham com o concorrente que aparece primeiro",
      "Reativação de base inativa sem campanha estruturada",
      "Upsell e cross-sell sem jornada definida",
    ],
  };
}

export function buildFallbackSolucao(ctx: FallbackContext): VMSolucao {
  return {
    problemas: [
      "Falta de previsibilidade no funil comercial",
      "Marca com baixa autoridade no digital",
      "Inexistência de processo claro de aquisição de clientes",
    ],
    solucao: `Implementamos uma operação completa de marketing e vendas para ${ctx.cliente}: estratégia, execução, governança e mensuração. Não é uma agência terceirizando tarefas — é um time integrado entregando resultado mês a mês.`,
    diferenciaisCompetitivos: [
      "Time sênior dedicado, não estagiário com cartilha",
      "Squad multidisciplinar (estratégia, mídia, criação, dados, CRM)",
      "Governança semanal com indicadores comerciais reais — não apenas vaidade",
      "Integração com seu time de vendas, não substituição",
    ],
    ganhosEsperados: [
      "Pipeline previsível e mensurável",
      "Custo por lead qualificado decrescente trimestre a trimestre",
      "Marca presente nos canais onde sua decisão de compra acontece",
      "Time interno liberado para focar no que entrega receita",
    ],
  };
}

export function buildFallbackBeneficios(): VMBeneficio[] {
  return [
    { titulo: "Previsibilidade comercial", descricao: "Pipeline mensurável com forecast confiável.", icone: "chart" },
    { titulo: "Time sênior dedicado", descricao: "Estratégia executada por quem entende do seu negócio.", icone: "users" },
    { titulo: "Governança semanal", descricao: "Reuniões com indicadores reais, não relatórios de vaidade.", icone: "calendar" },
    { titulo: "ROI rastreável", descricao: "Cada real investido conectado a resultado comercial.", icone: "target" },
  ];
}

export function buildFallbackROI(): VMROI {
  return {
    economiaEstimada: null,
    faturamentoAdicional: null,
    paybackMeses: null,
    premissas: [
      "ROI estimado conservadoramente a partir do ticket médio informado pelo cliente",
      "Curva de maturação típica: 60-90 dias para primeiros leads qualificados",
      "Performance varia conforme orçamento de mídia e ciclo de venda do segmento",
    ],
  };
}

export function buildFallbackTimeline(): VMTimelineEntrega[] {
  return [
    { semana: "Semana 1-2", titulo: "Kickoff e diagnóstico", entregas: ["Imersão com seu time", "Mapeamento de jornada e ICP", "Plano de ação 90 dias"] },
    { semana: "Semana 3-4", titulo: "Estruturação", entregas: ["Identidade e narrativa de marca", "Setup de canais e CRM", "Briefing de campanhas iniciais"] },
    { semana: "Mês 2", titulo: "Execução", entregas: ["Campanhas no ar", "Conteúdo recorrente", "Otimização semanal"] },
    { semana: "Mês 3", titulo: "Otimização e escala", entregas: ["Análise de resultados", "Realocação de budget por performance", "Plano do próximo ciclo"] },
  ];
}

export function buildFallbackCases(ctx: FallbackContext): VMCase[] {
  const seg = ctx.segmento?.trim() || "B2B";
  return [
    { cliente: "Cliente confidencial", segmento: seg, desafio: "Pipeline imprevisível e dependência de indicação", resultado: "3x leads qualificados em 90 dias" },
    { cliente: "Cliente confidencial", segmento: seg, desafio: "Marca pouco presente no digital", resultado: "Aumento de 180% em buscas pela marca em 6 meses" },
  ];
}

export function buildFallbackPorqueInfinda(): string[] {
  return [
    "Mais de uma década estruturando operações comerciais de empresas em crescimento",
    "Squad sênior multidisciplinar — sem terceirização escondida",
    "Modelo de governança baseado em indicadores comerciais reais",
    "Compromisso contratual com entrega e mensuração",
  ];
}

export function buildFallbackProximosPassos(): string[] {
  return [
    "Aprovação desta proposta",
    "Assinatura do contrato e emissão da primeira nota",
    "Kickoff agendado em até 5 dias úteis",
    "Briefing comercial conduzido pelo seu consultor",
    "Plano de ação dos primeiros 90 dias",
  ];
}