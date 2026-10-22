/**
 * export-contacts.ts
 *
 * Gera e dispara o download do CSV de contatos no formato exato esperado pelo
 * disparador WhatsApp (WASENDER):
 *
 * Formato de saída:
 *  - Separador: vírgula (,)
 *  - Encoding: UTF-8 com BOM (\uFEFF)
 *  - Filename: contatos_whatsapp_YYYY-MM-DD.csv
 *  - Colunas: nome,telefone,empresa
 *
 * Exemplo:
 *  nome,telefone,empresa
 *  João Silva,85999991234,Loja do João
 */

import type { Prospect } from "@/lib/mock-prospects";
import { normalizePhoneKey } from "@/lib/prospect-identity";

export interface ExportContactsResult {
  exported: number;
  skipped: number;
}

function csvCell(value: string | null | undefined): string {
  const s = value ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportContactsForDispatch(
  leads: Prospect[]
): ExportContactsResult {
  const CSV_SEP = ",";
  const BOM = "\uFEFF";

  const headers = ["nome", "telefone", "empresa"];
  const rows: string[] = [];
  const seenPhones = new Set<string>();

  let exported = 0;
  let skipped = 0;

  for (const p of leads) {
    const rawPhone = p.whatsapp || p.phone;
    const normalized = normalizePhoneKey(rawPhone);

    if (!normalized || normalized.length < 10) {
      skipped++;
      continue;
    }

    if (seenPhones.has(normalized)) {
      skipped++;
      continue;
    }
    seenPhones.add(normalized);

    const nome = p.owner?.trim() || p.company?.trim() || "Contato";
    const empresa = p.company?.trim() || nome;
    const telefone = normalized; // ex: 85999991234 (DDD + número)

    rows.push([csvCell(nome), csvCell(telefone), csvCell(empresa)].join(CSV_SEP));
    exported++;
  }

  const csvContent = BOM + [headers.join(CSV_SEP), ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `contatos_whatsapp_${today}.csv`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { exported, skipped };
}

export function countExportableContacts(leads: Prospect[]): number {
  const seen = new Set<string>();
  let count = 0;
  for (const p of leads) {
    const rawPhone = p.whatsapp || p.phone;
    const normalized = normalizePhoneKey(rawPhone);
    if (!normalized || normalized.length < 10 || seen.has(normalized)) continue;
    seen.add(normalized);
    count++;
  }
  return count;
}
