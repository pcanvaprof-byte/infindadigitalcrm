import type { AIContent } from "./schema";

export interface FallbackInput {
  titulo?: string | null;
  segmento?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  itens: Array<{
    nome: string;
    categoria?: string | null;
    area?: string | null;
    descricao?: string | null;
  }>;
  validade_dias?: number | null;
}

/**
 * Fallback determinístico — gerado em código, sem dependência de IA externa.
 * Objetivo: a proposta nunca fica "vazia", mesmo se o LLM cair, retornar lixo
 * ou for bloqueado por rate limit.
 */
export function buildDeterministicContent(input: FallbackInput): AIContent {
  const empresa = input.empresa?.trim() || "sua empresa";
  const segmento = input.segmento?.trim() || "seu setor";
  const cidade = input.cidade?.trim();
  const areas = unique(input.itens.map((i) => i.area).filter(Boolean) as string[]);
  const categorias = unique(input.itens.map((i) => i.categoria).filter(Boolean) as string[]);
  const nomes = input.itens.map((i) => i.nome).slice(0, 6);
  const validade = input.validade_dias ?? 7;

  const diagnostico =
    `Após análise do contexto comercial de ${empresa}${cidade ? ` (${cidade})` : ""}, ` +
    `identificamos oportunidades concretas para acelerar resultados em ${segmento}. ` +
    `O cenário atual demanda uma operação digital mais previsível, com pontos de fricção ` +
    `claros entre captação, conversão e retenção de clientes. ` +
    `A proposta a seguir foi desenhada para endereçar esses pontos de forma escalonável, ` +
    `com entregas mensuráveis e foco em retorno comercial direto.`;

  const problemas = pickFirst(
    [
      `Baixa previsibilidade de geração de demanda qualificada em ${segmento}.`,
      "Funil comercial sem instrumentação clara entre marketing, vendas e pós-venda.",
      "Presença digital fragmentada — canais operando sem narrativa única.",
      "Métricas de aquisição e retenção sem leitura semanal acionável.",
      "Processos comerciais dependentes de pessoas-chave, sem padronização.",
      "Conteúdo e SEO sem cadência, perdendo janela competitiva.",
    ],
    4,
  );

  const solucao =
    `Nossa recomendação combina ${nomes.length || "as frentes apresentadas"} em um plano integrado. ` +
    (areas.length
      ? `O escopo cobre ${humanList(areas)}, garantindo cobertura ponta-a-ponta. `
      : "") +
    (categorias.length
      ? `As entregas estão organizadas em ${humanList(categorias)}, permitindo evolução por estágios. `
      : "") +
    `Cada frente é instrumentada com indicadores próprios e cadência fixa de revisão, ` +
    `de modo que ${empresa} consiga avaliar retorno com clareza e ajustar prioridades a cada ciclo. ` +
    `O time INFINDA atua como extensão do seu, com consultoria estratégica acoplada à execução.`;

  const cronograma =
    "- Semana 1: Kickoff, alinhamento de KPIs e acessos.\n" +
    "- Semanas 2-4: Onboarding técnico, setup de instrumentação e primeiras entregas.\n" +
    "- Mês 2: Operação em regime, primeiros indicadores comparáveis.\n" +
    "- Mês 3: Revisão estratégica, expansão de escopo conforme resultados.";

  const observacoes =
    `Proposta válida por ${validade} dias a partir da data de envio. ` +
    "Condições comerciais e investimento estão detalhados nas seções seguintes. " +
    "Após aprovação, iniciamos o kickoff em até 5 dias úteis e o briefing estruturado é enviado automaticamente.";

  return { diagnostico, problemas, solucao, cronograma, observacoes };
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
function pickFirst<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n);
}
function humanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " e " + items[items.length - 1];
}