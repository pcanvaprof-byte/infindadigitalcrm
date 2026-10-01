import type { EnrichedAddress } from "./types";

const UF_LIST = new Set([
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
]);

const UF_BY_NAME: Record<string, string> = {
  "acre":"AC","alagoas":"AL","amazonas":"AM","amapa":"AP","bahia":"BA","ceara":"CE",
  "distrito federal":"DF","espirito santo":"ES","goias":"GO","maranhao":"MA",
  "minas gerais":"MG","mato grosso do sul":"MS","mato grosso":"MT","para":"PA",
  "paraiba":"PB","pernambuco":"PE","piaui":"PI","parana":"PR","rio de janeiro":"RJ",
  "rio grande do norte":"RN","rondonia":"RO","roraima":"RR","rio grande do sul":"RS",
  "santa catarina":"SC","sergipe":"SE","sao paulo":"SP","tocantins":"TO",
};

function stripDiacritics(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function collapseSpaces(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

function titleCase(v: string): string {
  const lowers = new Set(["de","da","do","das","dos","e","à","a","o"]);
  return v.toLocaleLowerCase("pt-BR").split(" ").map((w, i) => {
    if (!w) return w;
    if (i > 0 && lowers.has(w)) return w;
    // preserve short abbreviations (e.g. "SP")
    if (w.length <= 3 && /^[a-z0-9º°]+$/.test(w) && !/[aeiou]/.test(w)) return w.toUpperCase();
    return w[0].toLocaleUpperCase("pt-BR") + w.slice(1);
  }).join(" ");
}

function cleanText(v?: string | null, opts: { max?: number; upper?: boolean } = {}): string | undefined {
  if (!v) return undefined;
  let s = collapseSpaces(String(v));
  if (!s) return undefined;
  // remove control chars
  s = s.replace(/[\u0000-\u001f\u007f]/g, "");
  if (opts.upper) s = s.toUpperCase();
  else s = titleCase(s);
  if (opts.max && s.length > opts.max) s = s.slice(0, opts.max).trim();
  return s || undefined;
}

export function normalizeCep(cep?: string | null): string | undefined {
  if (!cep) return undefined;
  const digits = String(cep).replace(/\D/g, "");
  return digits.length === 8 ? digits : undefined;
}

export function normalizeUf(uf?: string | null): string | undefined {
  if (!uf) return undefined;
  const raw = collapseSpaces(String(uf));
  if (!raw) return undefined;
  const up = raw.toUpperCase();
  if (UF_LIST.has(up)) return up;
  const key = stripDiacritics(raw).toLowerCase();
  return UF_BY_NAME[key];
}

export function normalizeNumero(numero?: string | null): string | undefined {
  if (!numero) return undefined;
  const s = collapseSpaces(String(numero)).toUpperCase();
  if (!s) return undefined;
  if (/^(SN|S\/N|S-N|SEM NUMERO|SEM NÚMERO)\.?$/i.test(s)) return "S/N";
  // keep digits + optional letter suffix (e.g. 123A), otherwise raw uppercase
  const m = s.match(/^(\d{1,10})\s*([A-Z]{0,3})$/);
  if (m) return m[2] ? `${m[1]}${m[2]}` : m[1];
  return s.length > 20 ? s.slice(0, 20) : s;
}

export interface AddressValidation {
  address: EnrichedAddress;
  missing: Array<keyof EnrichedAddress>;
  isComplete: boolean;
}

/** Trim, uppercase UF, normalize CEP/numero, title-case textual parts, and
 *  drop empty fields. Never invents data — only cleans what is provided. */
export function normalizeAddress(input: EnrichedAddress | null | undefined): AddressValidation {
  const src = input ?? {};
  const address: EnrichedAddress = {
    cep: normalizeCep(src.cep),
    logradouro: cleanText(src.logradouro, { max: 160 }),
    numero: normalizeNumero(src.numero),
    complemento: cleanText(src.complemento, { max: 80 }),
    bairro: cleanText(src.bairro, { max: 80 }),
    cidade: cleanText(src.cidade, { max: 80 }),
    uf: normalizeUf(src.uf),
    regiao: cleanText(src.regiao, { max: 20 }),
  };
  const required: Array<keyof EnrichedAddress> = ["logradouro","bairro","cidade","uf"];
  const missing = required.filter((k) => !address[k]);
  return { address, missing, isComplete: missing.length === 0 };
}