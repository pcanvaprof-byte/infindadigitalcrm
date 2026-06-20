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
    texto: `Com base nas informações levantadas sobre ${ctx.cliente} e o segmento de ${seg}${cidade}, identificamos oportunidades para fortalecer a presença digital, estruturar processos comerciais e aumentar a previsibilidade da geração de oportunidades.`,
    riscosAtuais: [
      "Aquisição comercial concentrada em poucos canais",
      "Baixa estruturação de processos e indicadores",
      "Presença digital ainda em fase de consolidação",
      "Mensuração limitada do retorno por iniciativa",
    ],
    oportunidadesPerdidas: [
      "Estruturar canais digitais de aquisição contínua",
      "Implantar CRM e cadência comercial padronizada",
      "Mensurar resultados por canal e otimizar investimento",
    ],
  };
}

export function buildFallbackSolucao(ctx: FallbackContext): VMSolucao {
  return {
    problemas: [
      "Estruturação de processos comerciais e funil",
      "Consolidação da presença digital da marca",
      "Implantação de tecnologia, CRM e automação",
    ],
    solucao: `A INFINDA atua como parceira estratégica de ${ctx.cliente} na construção de uma operação comercial digital, integrando marketing, tecnologia, automação e inteligência de dados. O trabalho é conduzido com metodologia própria, governança contínua e indicadores compartilhados.`,
    diferenciaisCompetitivos: [
      "Metodologia consultiva integrando estratégia, tecnologia e execução",
      "Squad multidisciplinar dedicado (estratégia, mídia, dados, CRM)",
      "Governança contínua com indicadores e revisões estratégicas",
      "Integração com o time interno do cliente",
    ],
    ganhosEsperados: [
      "Maior organização comercial e clareza de processo",
      "Melhor aproveitamento dos leads gerados",
      "Redução de desperdícios em campanhas",
      "Maior capacidade de mensuração e tomada de decisão",
      "Processos escaláveis e replicáveis",
    ],
  };
}

export function buildFallbackBeneficios(): VMBeneficio[] {
  return [
    { titulo: "Governança contínua", descricao: "Reuniões periódicas para acompanhamento dos indicadores, definição de prioridades e evolução contínua da operação.", icone: "calendar" },
    { titulo: "Squad multidisciplinar", descricao: "Time sênior dedicado integrando estratégia, mídia, tecnologia e dados.", icone: "users" },
    { titulo: "Indicadores e dados", descricao: "Mensuração estruturada de cada frente, com decisões orientadas por dados.", icone: "chart" },
    { titulo: "Método e processo", descricao: "Metodologia própria aplicada a cada etapa do projeto, com previsibilidade de entrega.", icone: "target" },
  ];
}

export function buildFallbackROI(): VMROI {
  return {
    economiaEstimada: null,
    faturamentoAdicional: null,
    paybackMeses: null,
    premissas: [
      "Resultados dependem do investimento em mídia, ciclo de venda e maturidade digital atual",
      "Curva de maturação típica de 60 a 90 dias para os primeiros aprendizados consistentes",
      "Indicadores são acompanhados em governança periódica e ajustados ao longo do projeto",
    ],
  };
}

export function buildFallbackTimeline(): VMTimelineEntrega[] {
  return [
    { semana: "Semana 1-2", titulo: "Kickoff e imersão", entregas: ["Imersão com o time do cliente", "Mapeamento de jornada e ICP", "Plano de ação dos primeiros 90 dias"] },
    { semana: "Semana 3-4", titulo: "Estruturação", entregas: ["Configuração de canais, CRM e mensuração", "Definição de indicadores e linha de base", "Preparação das campanhas iniciais"] },
    { semana: "Mês 2", titulo: "Execução e otimização", entregas: ["Campanhas e cadência em operação", "Refinamento contínuo de mensagem e funil", "Governança periódica de resultados"] },
    { semana: "Mês 3", titulo: "Consolidação", entregas: ["Análise dos indicadores consolidados", "Realocação de investimento por performance", "Planejamento do próximo ciclo"] },
  ];
}

export function buildFallbackCases(ctx: FallbackContext): VMCase[] {
  const seg = ctx.segmento?.trim() || "B2B";
  return [
    {
      cliente: "Projeto confidencial",
      segmento: seg,
      desafio: "Baixa geração de oportunidades qualificadas e ausência de processo comercial estruturado.",
      resultado: "Estruturação da operação comercial digital, implantação de CRM e campanhas segmentadas com mensuração contínua.",
    },
    {
      cliente: "Projeto confidencial",
      segmento: seg,
      desafio: "Presença digital fragmentada e dificuldade de mensurar o retorno por canal.",
      resultado: "Consolidação da estratégia de marketing, governança por indicadores e integração entre marketing e vendas.",
    },
  ];
}

export function buildFallbackPorqueInfinda(): string[] {
  return [
    "Atuação consultiva integrando estratégia, tecnologia e execução",
    "Squad multidisciplinar sênior dedicado a cada projeto",
    "Metodologia própria com governança contínua e indicadores compartilhados",
    "Foco em crescimento sustentável e operação previsível",
  ];
}

export function buildFallbackProximosPassos(): string[] {
  return [
    "Aprovação da proposta",
    "Formalização contratual",
    "Reunião de kickoff",
    "Imersão estratégica com o time do cliente",
    "Início da implementação e estruturação",
  ];
}