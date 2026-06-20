import type {
  CrescimentoMaturidade,
  VMCrescimento,
  VMCrescimentoCenario,
} from "./types";

export interface CrescimentoInput {
  nicho: string;
  tipoNegocio?: string | null;
  ticketMedio: number;
  investimentoMensal: number;
  maturidade: CrescimentoMaturidade;
}

/**
 * Cálculo determinístico de projeção. NÃO é promessa, é cenário
 * baseado em comportamento médio de mercado por nível de maturidade.
 *
 * Lógica:
 *  - Multiplicador de retorno (faturamento / investimento total no período)
 *    varia por cenário e maturidade.
 *  - 90 dias = fase de estruturação (curva ainda subindo): ~28% do potencial de 180.
 *  - Novos clientes = faturamento adicional / ticket médio.
 */

const MATURIDADE_MULT: Record<CrescimentoMaturidade, number> = {
  baixa: 0.7,
  media: 1.0,
  alta: 1.3,
};

const CENARIO_BASE: Array<{
  nome: VMCrescimentoCenario["nome"];
  mult: number;
  baseJust: (ctx: { nicho: string; ticket: number }) => string;
}> = [
  {
    nome: "Conservador",
    mult: 2.0,
    baseJust: ({ nicho }) =>
      `Cenário conservador para ${nicho}: ciclo de venda mais longo, baixa maturidade digital e otimização gradual de campanhas. Considera apenas leads de canais já validados.`,
  },
  {
    nome: "Esperado",
    mult: 3.5,
    baseJust: ({ nicho, ticket }) =>
      `Comportamento médio observado em empresas de ${nicho} com ticket médio próximo de ${formatBRLLocal(
        ticket,
      )}. Funil ativo, mensagem ajustada à dor e cadência consistente de follow-up.`,
  },
  {
    nome: "Agressivo",
    mult: 5.5,
    baseJust: ({ nicho }) =>
      `Cenário de aceleração para ${nicho}: campanhas otimizadas continuamente, alta conversão de leads qualificados e equipe comercial ativa no follow-up. Requer execução acima da média.`,
  },
];

function formatBRLLocal(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

const RATIO_90 = 0.28; // primeiros 90 dias = ~28% do potencial dos 180

export function buildCrescimento(input: CrescimentoInput): VMCrescimento {
  const matMult = MATURIDADE_MULT[input.maturidade] ?? 1.0;
  const invest180 = input.investimentoMensal * 6;
  const invest90 = input.investimentoMensal * 3;

  const cenarios: VMCrescimentoCenario[] = CENARIO_BASE.map((c) => {
    const fat180 = Math.round(invest180 * c.mult * matMult);
    const fat90 = Math.round(fat180 * RATIO_90);
    const novos180 = input.ticketMedio > 0 ? Math.max(0, Math.round(fat180 / input.ticketMedio)) : 0;
    const novos90 = input.ticketMedio > 0 ? Math.max(0, Math.round(fat90 / input.ticketMedio)) : 0;
    return {
      nome: c.nome,
      faturamento90: fat90,
      faturamento180: fat180,
      roi90: invest90 > 0 ? Number((fat90 / invest90).toFixed(1)) : 0,
      roi180: invest180 > 0 ? Number((fat180 / invest180).toFixed(1)) : 0,
      novosClientes90: novos90,
      novosClientes180: novos180,
      justificativa: c.baseJust({ nicho: input.nicho, ticket: input.ticketMedio }),
    };
  });

  const premissas = [
    `Ticket médio considerado: ${formatBRLLocal(input.ticketMedio)}.`,
    `Investimento mensal de referência: ${formatBRLLocal(input.investimentoMensal)}.`,
    `Maturidade digital atual estimada como ${labelMat(input.maturidade)}.`,
    "Primeiros 30 dias são de estruturação, mensuração e otimização — resultados crescem ao longo de 3 a 6 meses.",
    "Projeção baseada em comportamento médio de mercado; não constitui garantia de resultado.",
  ];

  const fechamento =
    `Este modelo não é despesa mensal e sim construção de uma curva de aquisição. ` +
    `Para consolidar resultado em ${input.nicho}, o contrato mínimo recomendado é de 3 a 6 meses, ` +
    `período em que campanhas, mensagem e funil se ajustam ao comportamento real dos leads ` +
    `e o crescimento se torna progressivo e cumulativo.`;

  return {
    nicho: input.nicho,
    tipoNegocio: input.tipoNegocio ?? null,
    ticketMedio: input.ticketMedio,
    investimentoMensal: input.investimentoMensal,
    maturidade: input.maturidade,
    cenarios,
    premissas,
    fechamento,
  };
}

function labelMat(m: CrescimentoMaturidade): string {
  if (m === "baixa") return "baixa (operação ainda manual / pouca presença digital)";
  if (m === "alta") return "alta (canais ativos, dados e equipe comercial estruturada)";
  return "média (alguns canais ativos, processo parcial)";
}