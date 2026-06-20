import { z } from "zod";

/**
 * Schema estrito da resposta IA. Strings têm limites para evitar payload
 * estourado e arrays têm cardinality para forçar conteúdo objetivo.
 */
export const AIContentSchema = z.object({
  diagnostico: z.string().min(80).max(2000),
  problemas: z.array(z.string().min(8).max(180)).min(2).max(6),
  solucao: z.string().min(80).max(2000),
  cronograma: z.string().min(20).max(1200),
  observacoes: z.string().min(20).max(1200),
});

export type AIContent = z.infer<typeof AIContentSchema>;

/**
 * Heurística anti-genérico: rejeita respostas vazias de substância.
 * Retorna `null` se OK, ou string com motivo se deve ser rejeitada.
 */
const GENERIC_MARKERS = [
  "lorem ipsum",
  "como assistente de ia",
  "como modelo de linguagem",
  "não tenho informações",
  "insira aqui",
  "[cliente]",
  "[empresa]",
  "{{",
  "exemplo de proposta",
  "placeholder",
];

export function detectGenericContent(c: AIContent): string | null {
  const fullText = [
    c.diagnostico,
    c.solucao,
    c.cronograma,
    c.observacoes,
    ...c.problemas,
  ]
    .join(" \n ")
    .toLowerCase();

  for (const marker of GENERIC_MARKERS) {
    if (fullText.includes(marker)) return `marker_detectado:${marker}`;
  }

  // Repetição excessiva → resposta vazia disfarçada
  const tokens = fullText.split(/\s+/).filter((t) => t.length > 4);
  if (tokens.length < 60) return "conteudo_curto_demais";
  const uniq = new Set(tokens).size;
  if (uniq / tokens.length < 0.35) return "baixa_diversidade_lexical";

  return null;
}