// Deriva UF do lead a partir do DDD do telefone/whatsapp.
// Mantém só os 2 últimos dígitos do DDD (depois de remover +55, 0, etc).

const DDD_TO_UF: Record<string, string> = {
  // SP
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP",
  "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  // RJ / ES
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  // MG
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG",
  "37": "MG", "38": "MG",
  // PR / SC
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  // RS
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  // Centro-Oeste
  "61": "DF",
  "62": "GO", "64": "GO",
  "63": "TO",
  "65": "MT", "66": "MT",
  "67": "MS",
  // Norte
  "68": "AC",
  "69": "RO",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA", "99": "MA",
  // Nordeste
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE", "88": "CE",
  "86": "PI", "89": "PI",
};

export const UF_LIST: ReadonlyArray<string> = Array.from(
  new Set(Object.values(DDD_TO_UF)),
).sort();

function extractDdd(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // remove código do país 55 quando o número fica com 12+ dígitos
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  // remove zero inicial de tronco
  if (digits.length >= 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length < 10) return null;
  return digits.slice(0, 2);
}

export function leadUf(lead: {
  whatsapp?: string | null;
  telefone?: string | null;
}): string | null {
  const ddd =
    extractDdd(lead.whatsapp ?? null) ?? extractDdd(lead.telefone ?? null);
  if (!ddd) return null;
  return DDD_TO_UF[ddd] ?? null;
}