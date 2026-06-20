/**
 * Copy dinâmica por escopo: identifica os serviços presentes nos itens
 * da proposta e gera fragmentos de texto adequados ao que está sendo
 * contratado. Mantém tom consultivo (sem promessas numéricas).
 */

import type { VMItem } from "./types";

export type ServiceTag =
  | "trafego"
  | "site"
  | "landing"
  | "crm"
  | "ia_automacao"
  | "consultoria"
  | "seo"
  | "social"
  | "branding";

export interface ServiceProfile {
  tags: Set<ServiceTag>;
  primario: ServiceTag | null;
  rotulos: string[]; // p/ exibição ("Tráfego pago", "CRM", ...)
}

export interface DynamicCopy {
  pilares: string[];
  diagnosticoTexto: (clienteNome: string, segmento: string) => string;
  riscosAtuais: string[];
  oportunidades: string[];
  problemas: string[];
  solucaoTexto: (clienteNome: string) => string;
  diferenciais: string[];
  ganhosEsperados: string[];
  beneficios: { titulo: string; descricao: string; icone?: string }[];
  resultadosQualitativos: string[];
  fases: { periodo: string; titulo: string; entregas: string[] }[];
  proximosPassos: string[];
  cases: { desafio: string; solucao: string }[];
}

const PATTERNS: Array<{ tag: ServiceTag; rotulo: string; re: RegExp }> = [
  { tag: "trafego", rotulo: "Tráfego pago", re: /tr[aá]fego|ads\b|gerenciador|m[ií]dia paga|google ads|meta ads|facebook ads|instagram ads|campanha/i },
  { tag: "site", rotulo: "Site institucional", re: /\bsite\b|website|institucional|p[aá]gina institucional|portal/i },
  { tag: "landing", rotulo: "Landing page", re: /landing|\blp\b|p[aá]gina de vendas|p[aá]gina de captura|hot[sz]ite/i },
  { tag: "crm", rotulo: "CRM", re: /\bcrm\b|pipeline|funil de vendas|gest[aã]o comercial/i },
  { tag: "ia_automacao", rotulo: "Automação e IA", re: /\bia\b|intelig[eê]ncia artificial|automa[cç][aã]o|workflow|n8n|integra[cç][aã]o|chatbot|bot\b/i },
  { tag: "consultoria", rotulo: "Consultoria", re: /consultoria|mentoria|diagn[oó]stico|planejamento estrat/i },
  { tag: "seo", rotulo: "SEO", re: /\bseo\b|otimiza[cç][aã]o de busca|posicionamento org/i },
  { tag: "social", rotulo: "Social media", re: /social media|gest[aã]o de redes|conte[uú]do|reels|instagram org/i },
  { tag: "branding", rotulo: "Branding", re: /branding|identidade visual|marca\b|logo/i },
];

export function detectServices(items: Pick<VMItem, "nome" | "categoria" | "descricao">[]): ServiceProfile {
  const tags = new Set<ServiceTag>();
  const rotulosMap = new Map<ServiceTag, string>();
  for (const it of items) {
    const hay = `${it.nome} ${it.categoria ?? ""} ${it.descricao ?? ""}`;
    for (const p of PATTERNS) {
      if (p.re.test(hay)) {
        tags.add(p.tag);
        rotulosMap.set(p.tag, p.rotulo);
      }
    }
  }
  // ordem de prioridade do "primário" (o que dá tom geral à proposta)
  const prioridade: ServiceTag[] = ["trafego", "crm", "ia_automacao", "landing", "site", "seo", "consultoria", "social", "branding"];
  const primario = prioridade.find((t) => tags.has(t)) ?? null;
  const rotulos = Array.from(rotulosMap.values());
  return { tags, primario, rotulos };
}

/* --------------------------------------------------------------- */
/* Fragmentos por serviço — cada bloco contribui linhas únicas      */
/* --------------------------------------------------------------- */

const FRAG: Record<ServiceTag, Partial<DynamicCopy>> = {
  trafego: {
    pilares: ["Aquisição de clientes por mídia paga", "Otimização contínua de campanhas"],
    riscosAtuais: [
      "Investimento em mídia sem mensuração estruturada",
      "Campanhas pulverizadas sem foco em conversão",
    ],
    oportunidades: [
      "Estruturar campanhas com foco em geração de oportunidades qualificadas",
      "Otimizar investimento em mídia paga por indicadores de funil",
    ],
    problemas: ["Geração de leads de forma estruturada e mensurável"],
    diferenciais: ["Gestão profissional de mídia paga (Google Ads e Meta Ads)"],
    ganhosEsperados: [
      "Maior previsibilidade na geração de oportunidades",
      "Otimização do custo por lead ao longo do projeto",
    ],
    beneficios: [
      { titulo: "Aquisição estruturada", descricao: "Campanhas planejadas, segmentadas e mensuradas por indicadores de funil.", icone: "target" },
    ],
    resultadosQualitativos: [
      "Maior controle sobre o investimento em mídia",
      "Aumento da geração de oportunidades qualificadas",
    ],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Investimento em mídia paga sem mensuração consistente.", solucao: "Estruturação de campanhas segmentadas, mensuração por funil e otimização contínua." },
    ],
  },
  site: {
    pilares: ["Presença digital sólida e profissional"],
    riscosAtuais: ["Presença digital desatualizada compromete credibilidade"],
    oportunidades: ["Fortalecer a presença digital e a percepção de marca"],
    problemas: ["Site atual não reflete o posicionamento desejado"],
    diferenciais: ["Desenvolvimento web com foco em performance, SEO técnico e responsividade"],
    ganhosEsperados: [
      "Melhoria da experiência do usuário",
      "Site rápido, responsivo e tecnicamente otimizado",
    ],
    beneficios: [
      { titulo: "Identidade digital", descricao: "Site profissional com performance, SEO técnico e experiência responsiva.", icone: "award" },
    ],
    resultadosQualitativos: [
      "Fortalecimento da presença digital",
      "Melhoria da experiência e credibilidade percebida",
    ],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Presença digital fragmentada e site sem padronização.", solucao: "Desenvolvimento de site institucional com foco em performance, SEO técnico e responsividade." },
    ],
  },
  landing: {
    pilares: ["Páginas de alta performance focadas em conversão"],
    riscosAtuais: ["Tráfego direcionado a páginas com baixa conversão"],
    oportunidades: ["Estruturar páginas dedicadas à conversão por campanha"],
    problemas: ["Ausência de páginas otimizadas para conversão"],
    diferenciais: ["Landing pages estruturadas, testáveis e integradas ao CRM"],
    ganhosEsperados: [
      "Páginas dedicadas com foco claro de conversão",
      "Capacidade de testar e otimizar continuamente",
    ],
    beneficios: [
      { titulo: "Conversão dedicada", descricao: "Landing pages com foco em conversão, testes e integração com CRM.", icone: "zap" },
    ],
    resultadosQualitativos: [
      "Melhoria na conversão das ações de captação",
      "Capacidade de testar hipóteses de mensagem e oferta",
    ],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Investimento em mídia sem páginas dedicadas à conversão.", solucao: "Implantação de landing pages otimizadas com testes contínuos e integração com CRM." },
    ],
  },
  crm: {
    pilares: ["Organização comercial e gestão de relacionamento"],
    riscosAtuais: [
      "Histórico comercial fragmentado entre planilhas e canais",
      "Baixa visibilidade do pipeline e da produtividade do time",
    ],
    oportunidades: [
      "Centralizar o relacionamento com clientes em um único ambiente",
      "Estruturar pipeline, cadência e indicadores comerciais",
    ],
    problemas: ["Gestão comercial sem processo padronizado"],
    diferenciais: ["Implantação e operação assistida de CRM com indicadores comerciais"],
    ganhosEsperados: [
      "Histórico unificado de relacionamento com clientes",
      "Maior previsibilidade e produtividade comercial",
    ],
    beneficios: [
      { titulo: "Operação comercial estruturada", descricao: "CRM implantado com processo, cadência e indicadores claros.", icone: "users" },
    ],
    resultadosQualitativos: [
      "Maior organização e padronização comercial",
      "Melhor aproveitamento dos leads gerados",
      "Indicadores comerciais consolidados",
    ],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Gestão comercial dispersa em planilhas e sem padronização.", solucao: "Implantação de CRM com pipeline, cadência e indicadores comerciais." },
    ],
  },
  ia_automacao: {
    pilares: ["Automação de processos e ganho operacional"],
    riscosAtuais: ["Processos repetitivos consumindo capacidade do time"],
    oportunidades: ["Reduzir tarefas manuais com automações entre sistemas"],
    problemas: ["Baixa integração entre ferramentas e processos"],
    diferenciais: ["Automações e integrações desenhadas para escala"],
    ganhosEsperados: [
      "Redução de tarefas repetitivas",
      "Padronização e escalabilidade dos processos",
    ],
    beneficios: [
      { titulo: "Eficiência operacional", descricao: "Automações e integrações que reduzem tarefas manuais e padronizam processos.", icone: "rocket" },
    ],
    resultadosQualitativos: [
      "Maior eficiência operacional",
      "Integração entre equipes e sistemas",
    ],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Processos manuais e desconexão entre ferramentas operacionais.", solucao: "Desenho e implantação de automações com integração entre sistemas." },
    ],
  },
  consultoria: {
    pilares: ["Diagnóstico, estratégia e governança"],
    riscosAtuais: ["Decisões tomadas sem base estruturada em indicadores"],
    oportunidades: ["Estruturar planejamento e governança orientados por dados"],
    problemas: ["Ausência de método estruturado de tomada de decisão"],
    diferenciais: ["Acompanhamento executivo com governança contínua"],
    ganhosEsperados: [
      "Decisões orientadas por dados e indicadores",
      "Governança e acompanhamento executivo do projeto",
    ],
    beneficios: [
      { titulo: "Governança executiva", descricao: "Acompanhamento estratégico contínuo com indicadores compartilhados.", icone: "shield" },
    ],
    resultadosQualitativos: [
      "Aumento da capacidade de mensuração",
      "Decisões mais consistentes e orientadas por dados",
    ],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Decisões comerciais sem base consistente em indicadores.", solucao: "Diagnóstico, planejamento estratégico e governança contínua por indicadores." },
    ],
  },
  seo: {
    pilares: ["Visibilidade orgânica sustentável"],
    riscosAtuais: ["Baixa visibilidade em buscas orgânicas relevantes"],
    oportunidades: ["Construir presença orgânica sustentável de longo prazo"],
    problemas: ["Conteúdo e estrutura sem otimização para buscas"],
    diferenciais: ["SEO técnico e de conteúdo com foco em autoridade"],
    ganhosEsperados: ["Crescimento orgânico sustentável ao longo do tempo"],
    beneficios: [
      { titulo: "Visibilidade orgânica", descricao: "Estrutura técnica e de conteúdo otimizada para buscas relevantes.", icone: "chart" },
    ],
    resultadosQualitativos: ["Fortalecimento da presença orgânica"],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Baixa visibilidade orgânica em termos relevantes para o negócio.", solucao: "Trabalho técnico e de conteúdo orientado por análise de busca e autoridade." },
    ],
  },
  social: {
    pilares: ["Presença consistente em redes sociais"],
    riscosAtuais: ["Comunicação fragmentada nas redes sociais"],
    oportunidades: ["Estruturar comunicação consistente e alinhada à marca"],
    problemas: ["Conteúdo publicado sem linha editorial consistente"],
    diferenciais: ["Gestão de redes integrada à estratégia comercial"],
    ganhosEsperados: ["Comunicação consistente nas redes sociais"],
    beneficios: [
      { titulo: "Comunicação alinhada", descricao: "Conteúdo planejado e alinhado à estratégia de marca.", icone: "users" },
    ],
    resultadosQualitativos: ["Comunicação digital mais consistente"],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Comunicação digital sem linha editorial definida.", solucao: "Estruturação de planejamento de conteúdo e gestão integrada das redes." },
    ],
  },
  branding: {
    pilares: ["Identidade de marca coerente"],
    riscosAtuais: ["Identidade visual fragmentada entre canais"],
    oportunidades: ["Consolidar a identidade da marca de forma coerente"],
    problemas: ["Identidade visual sem padronização entre pontos de contato"],
    diferenciais: ["Branding desenhado com método e aplicação consistente"],
    ganhosEsperados: ["Maior coerência e percepção de marca"],
    beneficios: [
      { titulo: "Identidade consistente", descricao: "Marca aplicada de forma coerente em todos os pontos de contato.", icone: "award" },
    ],
    resultadosQualitativos: ["Maior coerência de marca entre canais"],
    fases: [],
    proximosPassos: [],
    cases: [
      { desafio: "Aplicação inconsistente da marca entre canais e materiais.", solucao: "Padronização da identidade visual e aplicação consistente entre pontos de contato." },
    ],
  },
};

/* --------------------------------------------------------------- */
/* Fases — dinâmicas por serviço primário                           */
/* --------------------------------------------------------------- */

function fasesFor(primario: ServiceTag | null): DynamicCopy["fases"] {
  const base = [
    {
      periodo: "30 dias",
      titulo: "Estruturação",
      entregas: [
        "Imersão com o time do cliente",
        "Implantação inicial e configuração dos sistemas",
        "Definição de indicadores e linha de base",
      ],
    },
    {
      periodo: "60 dias",
      titulo: "Otimização",
      entregas: [
        "Refinamento das entregas conforme aprendizados",
        "Ajustes operacionais e de processo",
        "Primeiros indicadores consolidados",
      ],
    },
    {
      periodo: "90 dias",
      titulo: "Consolidação",
      entregas: [
        "Processos mais maduros e replicáveis",
        "Melhoria contínua orientada por dados",
        "Decisões baseadas em indicadores",
      ],
    },
    {
      periodo: "180 dias",
      titulo: "Escala",
      entregas: [
        "Expansão das frentes ativas",
        "Identificação de novas oportunidades",
        "Operação sustentável e previsível",
      ],
    },
  ];
  if (primario === "trafego") {
    base[0].entregas = [
      "Configuração de gerenciadores e tags de mensuração",
      "Estruturação inicial de campanhas e funil",
      "Definição de indicadores e linha de base",
    ];
    base[1].entregas = [
      "Refinamento de segmentações e criativos",
      "Ajustes de funil e otimização de conversão",
      "Primeiros aprendizados das campanhas",
    ];
  } else if (primario === "site" || primario === "landing") {
    base[0].entregas = [
      "Arquitetura, wireframes e definição técnica",
      "Desenvolvimento das páginas principais",
      "Integrações e mensuração configuradas",
    ];
    base[1].entregas = [
      "Publicação e ajustes pós-lançamento",
      "Otimizações de performance e SEO técnico",
      "Primeiros aprendizados de uso",
    ];
  } else if (primario === "crm") {
    base[0].entregas = [
      "Modelagem de pipeline e processos comerciais",
      "Configuração do CRM e migração inicial",
      "Treinamento do time e definição de cadência",
    ];
    base[1].entregas = [
      "Refinamento dos processos com base no uso real",
      "Ajustes de campos, automações e relatórios",
      "Primeiros indicadores comerciais consolidados",
    ];
  } else if (primario === "ia_automacao") {
    base[0].entregas = [
      "Mapeamento dos processos automatizáveis",
      "Desenho e implantação das primeiras automações",
      "Integrações entre sistemas configuradas",
    ];
    base[1].entregas = [
      "Refinamento dos fluxos com base em uso real",
      "Inclusão de novas etapas automatizadas",
      "Indicadores de eficiência operacional",
    ];
  }
  return base;
}

/* --------------------------------------------------------------- */
/* Builder principal                                                */
/* --------------------------------------------------------------- */

export function buildDynamicCopy(profile: ServiceProfile): DynamicCopy {
  const tags = profile.tags.size > 0 ? Array.from(profile.tags) : (["consultoria"] as ServiceTag[]);

  const merge = <K extends keyof Omit<DynamicCopy, "diagnosticoTexto" | "solucaoTexto" | "fases">>(
    key: K,
  ): DynamicCopy[K] => {
    const out: unknown[] = [];
    for (const t of tags) {
      const slice = (FRAG[t] as Partial<DynamicCopy>)[key];
      if (Array.isArray(slice)) for (const v of slice) out.push(v);
    }
    return dedupe(out) as DynamicCopy[K];
  };

  const pilares = merge("pilares") as string[];
  const riscosAtuais = merge("riscosAtuais") as string[];
  const oportunidades = merge("oportunidades") as string[];
  const problemas = merge("problemas") as string[];
  const diferenciais = merge("diferenciais") as string[];
  const ganhosEsperados = merge("ganhosEsperados") as string[];
  const beneficios = merge("beneficios") as DynamicCopy["beneficios"];
  const resultadosQualitativos = merge("resultadosQualitativos") as string[];
  const casesFragments = merge("cases") as { desafio: string; solucao: string }[];

  // Garante mínimo de 4 benefícios — completa com bases consultivas
  const baseBenef: DynamicCopy["beneficios"] = [
    { titulo: "Governança contínua", descricao: "Reuniões periódicas para acompanhamento dos indicadores e evolução do projeto.", icone: "calendar" },
    { titulo: "Squad multidisciplinar", descricao: "Time sênior dedicado integrando estratégia, tecnologia e dados.", icone: "users" },
    { titulo: "Decisões por indicadores", descricao: "Mensuração estruturada das frentes ativas e decisões orientadas por dados.", icone: "chart" },
    { titulo: "Método e processo", descricao: "Metodologia aplicada a cada etapa do projeto, com previsibilidade de entrega.", icone: "target" },
  ];
  for (const b of baseBenef) {
    if (beneficios.length >= 4) break;
    if (!beneficios.some((x) => x.titulo === b.titulo)) beneficios.push(b);
  }

  const fases = fasesFor(profile.primario);

  // Próximos passos — padrão consultivo, agnóstico ao serviço
  const proximosPassos = [
    "Aprovação da proposta",
    "Formalização contratual",
    "Reunião de kickoff",
    "Imersão estratégica com o time do cliente",
    "Início da implementação",
  ];

  return {
    pilares: pilares.slice(0, 5),
    diagnosticoTexto: (cliente, seg) =>
      buildDiagnosticoTexto(cliente, seg, profile),
    riscosAtuais: riscosAtuais.slice(0, 5),
    oportunidades: oportunidades.slice(0, 5),
    problemas: problemas.slice(0, 5),
    solucaoTexto: (cliente) => buildSolucaoTexto(cliente, profile),
    diferenciais: diferenciais.slice(0, 5),
    ganhosEsperados: ganhosEsperados.slice(0, 5),
    beneficios: beneficios.slice(0, 4),
    resultadosQualitativos: resultadosQualitativos.slice(0, 6),
    fases,
    proximosPassos,
    cases: casesFragments.slice(0, 3),
  };
}

function buildDiagnosticoTexto(cliente: string, segmento: string, p: ServiceProfile): string {
  const seg = segmento?.trim() || "seu segmento";
  if (p.rotulos.length === 0) {
    return `Com base nas informações levantadas sobre ${cliente} no segmento de ${seg}, identificamos oportunidades para estruturar processos, fortalecer a presença digital e aumentar a previsibilidade da operação.`;
  }
  const frentes = formatList(p.rotulos);
  return `Com base nas informações levantadas sobre ${cliente} (${seg}), a proposta concentra-se em ${frentes}. O objetivo é estruturar uma operação mais previsível e mensurável, com indicadores compartilhados e melhoria contínua ao longo do projeto.`;
}

function buildSolucaoTexto(cliente: string, p: ServiceProfile): string {
  if (p.rotulos.length === 0) {
    return `A INFINDA atua como parceira estratégica de ${cliente} na construção de uma operação comercial digital, integrando tecnologia, automação e inteligência de dados, com metodologia própria e governança contínua.`;
  }
  const frentes = formatList(p.rotulos);
  return `A INFINDA atuará junto a ${cliente} na implementação e operação assistida das frentes contratadas: ${frentes}. O trabalho é conduzido com metodologia própria, governança contínua e indicadores compartilhados, com foco em construir uma operação sustentável.`;
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const v of arr) {
    const k = typeof v === "string" ? v : JSON.stringify(v);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}