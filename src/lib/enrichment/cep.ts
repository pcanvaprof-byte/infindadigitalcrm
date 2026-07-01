import type { EnrichedAddress } from "./types";
import { pfetch } from "./proxy";

const REGIAO: Record<string, string> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export async function fetchCep(cep: string): Promise<EnrichedAddress | null> {
  const clean = (cep || "").replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const res = await pfetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!res.ok) return null;
  const d = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
  if (d.erro) return null;
  return {
    cep: clean,
    logradouro: d.logradouro,
    bairro: d.bairro,
    cidade: d.localidade,
    uf: d.uf,
    regiao: REGIAO[d.uf],
  };
}

export function mergeAddress(base: EnrichedAddress, extra: EnrichedAddress | null): EnrichedAddress {
  if (!extra) return { ...base, regiao: base.regiao ?? (base.uf ? REGIAO[base.uf] : undefined) };
  return {
    cep: base.cep || extra.cep,
    logradouro: base.logradouro || extra.logradouro,
    numero: base.numero || extra.numero,
    complemento: base.complemento || extra.complemento,
    bairro: base.bairro || extra.bairro,
    cidade: base.cidade || extra.cidade,
    uf: base.uf || extra.uf,
    regiao: extra.regiao || (base.uf ? REGIAO[base.uf] : undefined),
  };
}