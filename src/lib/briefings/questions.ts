import type { BriefingSection, BriefingServico, BriefingTipo } from "./types";

export const PAGE_SALES_QUESTIONS: BriefingSection[] = [
  {
    id: "oferta",
    title: "Sobre a Oferta",
    questions: [
      { id: "produto", label: "Qual produto ou serviço será vendido?", type: "textarea", required: true },
      { id: "problema", label: "Qual problema ele resolve?", type: "textarea", required: true },
      { id: "beneficio", label: "Qual principal benefício?", type: "textarea", required: true },
      { id: "valor", label: "Qual valor da oferta?", type: "text" },
      { id: "parcelamento", label: "Existe parcelamento?", type: "radio", options: ["Sim", "Não"] },
      { id: "garantia", label: "Existe garantia?", type: "textarea" },
      { id: "bonus", label: "Possui bônus?", type: "textarea" },
      { id: "diferencial", label: "Qual diferencial da oferta?", type: "textarea" },
    ],
  },
  {
    id: "publico",
    title: "Público-Alvo",
    questions: [
      { id: "cliente_ideal", label: "Quem é o cliente ideal?", type: "textarea", required: true },
      { id: "faixa_etaria", label: "Faixa etária?", type: "text" },
      { id: "sexo", label: "Sexo predominante?", type: "select", options: ["Indiferente", "Masculino", "Feminino"] },
      { id: "regiao", label: "Cidade/Estado?", type: "text" },
      { id: "dores", label: "Principais dores?", type: "textarea" },
      { id: "desejos", label: "Principais desejos?", type: "textarea" },
      { id: "objecoes", label: "Principais objeções?", type: "textarea" },
    ],
  },
  {
    id: "conversao",
    title: "Conversão",
    questions: [
      {
        id: "objetivo",
        label: "Objetivo da página",
        type: "select",
        options: ["Venda direta", "Captura de leads", "WhatsApp", "Agendamento"],
        required: true,
      },
      { id: "depoimentos", label: "Possui depoimentos?", type: "radio", options: ["Sim", "Não"] },
      { id: "provas_sociais", label: "Possui provas sociais?", type: "radio", options: ["Sim", "Não"] },
      { id: "videos", label: "Possui vídeos?", type: "radio", options: ["Sim", "Não"] },
      { id: "fotos", label: "Possui fotos profissionais?", type: "radio", options: ["Sim", "Não"] },
    ],
  },
  {
    id: "referencias",
    title: "Referências",
    questions: [
      { id: "concorrentes", label: "Cite concorrentes", type: "textarea" },
      { id: "paginas_referencia", label: "Cite páginas que você gosta", type: "textarea" },
    ],
  },
];

export const MENTORIA_QUESTIONS: BriefingSection[] = [
  {
    id: "negocio",
    title: "Sobre o Negócio",
    questions: [
      { id: "nicho", label: "Qual o nicho da empresa?", type: "text", required: true },
      { id: "produto", label: "O que você vende?", type: "textarea", required: true },
      { id: "ticket", label: "Ticket médio?", type: "text" },
      { id: "tempo_mercado", label: "Tempo de mercado?", type: "text" },
      { id: "investe_mkt", label: "Já investe em marketing?", type: "radio", options: ["Sim", "Não"] },
    ],
  },
  {
    id: "objetivos",
    title: "Objetivos",
    questions: [
      {
        id: "objetivo",
        label: "O que deseja alcançar?",
        type: "select",
        options: ["Mais vendas", "Mais leads", "Escalar operação", "Estruturar marketing"],
        required: true,
      },
      { id: "faturamento", label: "Qual faturamento atual?", type: "text" },
      { id: "meta_12m", label: "Qual meta para os próximos 12 meses?", type: "textarea" },
    ],
  },
  {
    id: "estrutura",
    title: "Estrutura Atual",
    questions: [
      { id: "site", label: "Possui site?", type: "radio", options: ["Sim", "Não"] },
      { id: "lp", label: "Possui landing page?", type: "radio", options: ["Sim", "Não"] },
      { id: "crm", label: "Possui CRM?", type: "radio", options: ["Sim", "Não"] },
      { id: "comercial", label: "Possui equipe comercial?", type: "radio", options: ["Sim", "Não"] },
      { id: "vendedores", label: "Quantos vendedores?", type: "text" },
    ],
  },
  {
    id: "trafego",
    title: "Tráfego",
    questions: [
      { id: "ja_anunciou", label: "Já anunciou?", type: "radio", options: ["Sim", "Não"] },
      {
        id: "plataformas",
        label: "Em quais plataformas?",
        type: "textarea",
        placeholder: "Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads…",
      },
      { id: "investimento_mes", label: "Quanto investe por mês?", type: "text" },
      { id: "desafio", label: "Qual foi o maior desafio até hoje?", type: "textarea" },
    ],
  },
  {
    id: "expectativas",
    title: "Expectativas",
    questions: [
      { id: "espera_mentoria", label: "O que espera da mentoria?", type: "textarea", required: true },
      { id: "resultado_6m", label: "Qual seria o resultado ideal após 6 meses?", type: "textarea" },
    ],
  },
];

export const GESTAO_TRAFEGO_QUESTIONS: BriefingSection[] = [
  {
    id: "empresa",
    title: "Sobre a Empresa",
    questions: [
      { id: "produto", label: "Qual produto ou serviço vende?", type: "textarea", required: true },
      { id: "ticket", label: "Ticket médio?", type: "text" },
      { id: "regiao", label: "Região atendida?", type: "text" },
      { id: "comercial", label: "Possui equipe comercial?", type: "radio", options: ["Sim", "Não"] },
    ],
  },
  {
    id: "objetivos",
    title: "Objetivos",
    questions: [
      {
        id: "objetivo",
        label: "Selecione",
        type: "select",
        options: ["Gerar Leads", "Gerar Vendas", "WhatsApp", "Agendamentos", "Reconhecimento de Marca"],
        required: true,
      },
    ],
  },
  {
    id: "estrutura",
    title: "Estrutura Atual",
    questions: [
      { id: "instagram", label: "Possui Instagram?", type: "radio", options: ["Sim", "Não"] },
      { id: "facebook", label: "Possui Facebook?", type: "radio", options: ["Sim", "Não"] },
      { id: "site", label: "Possui Site?", type: "radio", options: ["Sim", "Não"] },
      { id: "lp", label: "Possui Landing Page?", type: "radio", options: ["Sim", "Não"] },
      { id: "crm", label: "Possui CRM?", type: "radio", options: ["Sim", "Não"] },
    ],
  },
  {
    id: "publico",
    title: "Público-Alvo",
    questions: [
      { id: "cliente_ideal", label: "Quem é seu cliente ideal?", type: "textarea", required: true },
      { id: "idade", label: "Idade?", type: "text" },
      { id: "sexo", label: "Sexo?", type: "select", options: ["Indiferente", "Masculino", "Feminino"] },
      { id: "cidade", label: "Cidade?", type: "text" },
      { id: "interesses", label: "Interesses?", type: "textarea" },
    ],
  },
  {
    id: "investimento",
    title: "Investimento",
    questions: [
      { id: "verba_ads", label: "Quanto pretende investir em anúncios mensalmente?", type: "text", required: true },
      { id: "verba_gestao", label: "Quanto pretende investir na gestão?", type: "text" },
      { id: "sazonalidade", label: "Existe sazonalidade no negócio?", type: "textarea" },
    ],
  },
];

const COMMERCIAL_QUESTIONS: Record<BriefingServico, BriefingSection[]> = {
  pagina_vendas: PAGE_SALES_QUESTIONS,
  mentoria_trafego: MENTORIA_QUESTIONS,
  gestao_trafego: GESTAO_TRAFEGO_QUESTIONS,
};

// ============= KICKOFF (pós-venda) =============

const KICKOFF_GESTAO: BriefingSection[] = [
  {
    id: "empresa",
    title: "Dados da Empresa",
    questions: [
      { id: "razao", label: "Razão Social", type: "text", required: true },
      { id: "cnpj", label: "CNPJ", type: "text" },
      { id: "site", label: "Site", type: "text" },
    ],
  },
  {
    id: "acessos",
    title: "Acessos",
    questions: [
      { id: "facebook", label: "Login do Facebook", type: "text" },
      { id: "instagram", label: "Login do Instagram", type: "text" },
      { id: "bm", label: "ID do Business Manager", type: "text" },
      { id: "ads", label: "ID da Conta de Anúncios", type: "text" },
      { id: "pixel", label: "ID do Pixel", type: "text" },
      { id: "gtm", label: "ID do Tag Manager", type: "text" },
      { id: "analytics", label: "ID do Google Analytics (GA4)", type: "text" },
    ],
  },
  {
    id: "comercial",
    title: "Comercial",
    questions: [
      { id: "whatsapp", label: "WhatsApp comercial", type: "text", required: true },
      { id: "horario", label: "Horário de atendimento", type: "text" },
      { id: "equipe", label: "Equipe comercial (qtd, papéis)", type: "textarea" },
      { id: "script", label: "Script de vendas atual", type: "textarea" },
    ],
  },
  {
    id: "materiais",
    title: "Materiais",
    questions: [
      { id: "logo", label: "Logotipo", type: "upload", accept: "image/*,.pdf" },
      { id: "manual_marca", label: "Manual da marca", type: "upload", accept: ".pdf,.zip" },
      { id: "fotos", label: "Fotos", type: "upload", multiple: true, accept: "image/*,.zip" },
      { id: "videos", label: "Vídeos", type: "upload", multiple: true, accept: "video/mp4,.zip" },
      { id: "catalogos", label: "Catálogos", type: "upload", multiple: true, accept: ".pdf,.zip" },
    ],
  },
  {
    id: "objetivos",
    title: "Objetivos",
    questions: [
      { id: "meta_mensal", label: "Meta mensal", type: "text", required: true },
      { id: "meta_trimestral", label: "Meta trimestral", type: "text" },
    ],
  },
  {
    id: "concorrentes",
    title: "Concorrentes",
    questions: [
      { id: "lista", label: "Cite até 5 concorrentes", type: "textarea" },
    ],
  },
];

const KICKOFF_PAGINA: BriefingSection[] = [
  {
    id: "produto",
    title: "Produto",
    questions: [
      { id: "nome", label: "Nome do produto", type: "text", required: true },
      { id: "valor", label: "Valor", type: "text", required: true },
      { id: "garantia", label: "Garantia", type: "textarea" },
      { id: "bonus", label: "Bônus", type: "textarea" },
    ],
  },
  {
    id: "conteudo",
    title: "Conteúdo disponível",
    questions: [
      { id: "copy", label: "Possui copy/texto base?", type: "radio", options: ["Sim", "Não"] },
      { id: "vsl", label: "Possui VSL?", type: "radio", options: ["Sim", "Não"] },
      { id: "depoimentos", label: "Possui depoimentos?", type: "radio", options: ["Sim", "Não"] },
      { id: "midias", label: "Mídias (imagens / vídeos)", type: "upload", multiple: true, accept: "image/*,video/mp4,.zip" },
    ],
  },
  {
    id: "integracoes",
    title: "Integrações",
    questions: [
      { id: "checkout", label: "Plataforma de checkout", type: "text" },
      { id: "crm", label: "CRM utilizado", type: "text" },
      { id: "pixel", label: "Pixel ID", type: "text" },
      { id: "analytics", label: "GA4 ID", type: "text" },
    ],
  },
  {
    id: "referencias",
    title: "Referências",
    questions: [
      { id: "paginas", label: "Páginas de exemplo", type: "textarea" },
      { id: "concorrentes", label: "Concorrentes", type: "textarea" },
    ],
  },
];

const KICKOFF_MENTORIA: BriefingSection[] = [
  {
    id: "estrutura",
    title: "Estrutura Atual",
    questions: [
      { id: "site", label: "Possui site?", type: "radio", options: ["Sim", "Não"] },
      { id: "crm", label: "Possui CRM?", type: "radio", options: ["Sim", "Não"] },
      { id: "lps", label: "Quantas landing pages ativas?", type: "text" },
    ],
  },
  {
    id: "equipe",
    title: "Equipe",
    questions: [
      { id: "vendedores", label: "Quantos vendedores?", type: "text" },
      { id: "atendentes", label: "Quantos atendentes?", type: "text" },
    ],
  },
  {
    id: "indicadores",
    title: "Indicadores Atuais",
    questions: [
      { id: "leads_mes", label: "Leads / mês", type: "text" },
      { id: "conversao", label: "Taxa de conversão", type: "text" },
      { id: "faturamento", label: "Faturamento mensal", type: "text" },
    ],
  },
  {
    id: "objetivos",
    title: "Objetivos",
    questions: [
      { id: "meta_90", label: "Meta 90 dias", type: "textarea", required: true },
      { id: "meta_180", label: "Meta 180 dias", type: "textarea" },
      { id: "meta_365", label: "Meta 365 dias", type: "textarea" },
    ],
  },
  {
    id: "materiais",
    title: "Materiais de apoio",
    questions: [
      { id: "anexos", label: "Documentos / planilhas", type: "upload", multiple: true, accept: ".pdf,.doc,.docx,.zip" },
    ],
  },
];

const KICKOFF_QUESTIONS: Record<BriefingServico, BriefingSection[]> = {
  gestao_trafego: KICKOFF_GESTAO,
  pagina_vendas: KICKOFF_PAGINA,
  mentoria_trafego: KICKOFF_MENTORIA,
};

export function getQuestions(
  tipoOrServico: BriefingTipo | BriefingServico,
  servico?: BriefingServico,
): BriefingSection[] {
  // Compat: chamada antiga getQuestions(servico)
  if (servico === undefined) {
    return COMMERCIAL_QUESTIONS[tipoOrServico as BriefingServico] ?? [];
  }
  const tipo = tipoOrServico as BriefingTipo;
  if (tipo === "kickoff_producao") return KICKOFF_QUESTIONS[servico] ?? [];
  return COMMERCIAL_QUESTIONS[servico] ?? [];
}

export function countQuestions(sections: BriefingSection[]): number {
  return sections.reduce((acc, s) => acc + s.questions.length, 0);
}