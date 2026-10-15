/**
 * export-contacts.ts
 *
 * Gera e dispara o download de um CSV de contatos para ferramentas de disparo
 * externas (WhatsApp bulk senders, etc.).
 *
 * Formato de saída:
 *  - Separador: ponto e vírgula (;) — padrão regional brasileiro e da maioria dos disparadores
 *  - Encoding: UTF-8 com BOM (\uFEFF) para compatibilidade com Excel
 *  - Filename: contatos-disparo-YYYY-MM-DD.csv
 *  - Colunas: nome;empresa;whatsapp;telefone;email;cidade;uf;nicho;cnpj;mensagem;prospect_id
 */

import type { Prospect } from "@/lib/mock-prospects";
import { normalizePhoneKey } from "@/lib/prospect-identity";
import { pickNicheMessage } from "@/lib/prospeccao/niche-templates";
import { renderTemplate, sanitizeTemplateForSend } from "@/lib/cadencia/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ExportContactsResult {
  /** Quantidade de linhas efetivamente gravadas no CSV. */
  exported: number;
  /** Quantidade de leads ignorados (WhatsApp inválido ou número duplicado). */
  skipped: number;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Escapa aspas duplas e envolve o valor em aspas para CSV seguro. */
function csvCell(value: string | null | undefined): string {
  const s = (value ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

/**
 * Constrói a mensagem personalizada para o lead.
 *
 * Ordem de prioridade:
 *  1. initial_message do perfil do negócio (bizInitialMessage)
 *  2. Template do nicho correspondente ao segmento do lead
 *
 * Após obter o corpo, aplica renderTemplate (substitui {{empresa}}, {{responsavel}}, etc.)
 * e sanitizeTemplateForSend (remove artefatos de formatação).
 *
 * NOTA: `p.owner` é o vendedor interno (campo "owner" do Prospect). Ele é o
 * melhor campo disponível de forma síncrona para preencher "responsavel"/"contato".
 * O nome do contato real do cliente (cad_leads.responsavel) exigiria busca async
 * por lead — impraticável para exportação em lote.
 */
function buildMessage(
  p: Prospect,
  bizInitialMessage: string | null | undefined,
  nicheOverrides: ReadonlyMap<string, string> | null | undefined,
): string {
  const corpo = bizInitialMessage?.trim()
    ? bizInitialMessage.trim()
    : pickNicheMessage(p.company, p.segment, nicheOverrides ?? null, "export:disparo", {
        prospectId: p.id,
      });

  const rendered = renderTemplate(corpo, {
    empresa: p.company ?? "",
    responsavel: p.owner ?? "",
  });

  return sanitizeTemplateForSend(rendered);
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Exporta a lista de leads como CSV para disparo externo e dispara o download.
 *
 * @param leads            Lista de prospects a exportar (filteredOrdered ou selecionados).
 * @param bizInitialMessage Mensagem inicial cadastrada no perfil do negócio
 *                          (business_profiles.initial_message). Se null/vazio, usa nicho.
 * @param nicheOverrides   Mapa de overrides de templates por nicho da organização.
 * @returns                Contadores { exported, skipped } para exibir no toast.
 */
export function exportContactsForDispatch(
  leads: Prospect[],
  bizInitialMessage: string | null | undefined,
  nicheOverrides: ReadonlyMap<string, string> | null | undefined,
): ExportContactsResult {
  const CSV_SEP = ";";
  const BOM = "\uFEFF";

  const headers = [
    "nome",
    "empresa",
    "whatsapp",
    "telefone",
    "email",
    "cidade",
    "uf",
    "nicho",
    "cnpj",
    "mensagem",
    "prospect_id",
  ];

  const rows: string[] = [];
  // Set de dígitos normalizados já vistos — evita duplo disparo para o mesmo número.
  const seenPhones = new Set<string>();

  let exported = 0;
  let skipped = 0;

  for (const p of leads) {
    // 1. Valida e normaliza WhatsApp → dígitos sem 55 (ex: "11987654321")
    const normalized = normalizePhoneKey(p.whatsapp);

    if (!normalized) {
      skipped++;
      continue;
    }

    // 2. Deduplica por número de telefone
    if (seenPhones.has(normalized)) {
      skipped++;
      continue;
    }
    seenPhones.add(normalized);

    // 3. Formata número para padrão internacional (55 + DDD + número)
    const whatsappIntl = `55${normalized}`;

    // 4. Telefone fixo (coluna auxiliar, sem formatação internacional forçada)
    const telefone = p.phone ?? "";

    // 5. Personaliza a mensagem
    const mensagem = buildMessage(p, bizInitialMessage, nicheOverrides);

    // 6. Monta a linha CSV
    const row = [
      csvCell(p.owner || p.company), // nome (responsável/contato — ver NOTA acima)
      csvCell(p.company),
      csvCell(whatsappIntl),
      csvCell(telefone),
      csvCell(p.email),
      csvCell(p.city),
      csvCell(p.state),
      csvCell(p.segment),
      csvCell(p.cnpj),
      csvCell(mensagem),
      csvCell(p.id), // prospect_id
    ].join(CSV_SEP);

    rows.push(row);
    exported++;
  }

  // Monta CSV completo com BOM
  const csvContent = BOM + [headers.map(csvCell).join(CSV_SEP), ...rows].join("\n");

  // Gera e dispara download via Blob
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  anchor.href = url;
  anchor.download = `contatos-disparo-${today}.csv`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Libera memória após pequeno delay para garantir que o download iniciou
  setTimeout(() => URL.revokeObjectURL(url), 1_000);

  return { exported, skipped };
}

// ---------------------------------------------------------------------------
// Helper utilitário (reutilizável na UI para calcular contagem do botão)
// ---------------------------------------------------------------------------

/**
 * Conta quantos leads da lista têm WhatsApp válido e único.
 * Usado para exibir a contagem no label do botão antes de exportar.
 */
export function countExportableContacts(leads: Prospect[]): number {
  const seen = new Set<string>();
  let count = 0;
  for (const p of leads) {
    const normalized = normalizePhoneKey(p.whatsapp);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    count++;
  }
  return count;
}
