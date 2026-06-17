import type { BriefingSection, BriefingServico } from "./types";

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

export function getQuestions(servico: BriefingServico): BriefingSection[] {
  switch (servico) {
    case "pagina_vendas":
      return PAGE_SALES_QUESTIONS;
    case "mentoria_trafego":
      return MENTORIA_QUESTIONS;
    case "gestao_trafego":
      return GESTAO_TRAFEGO_QUESTIONS;
  }
}

export function countQuestions(sections: BriefingSection[]): number {
  return sections.reduce((acc, s) => acc + s.questions.length, 0);
}