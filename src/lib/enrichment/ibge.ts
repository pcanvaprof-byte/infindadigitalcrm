import type { MarketData } from "./types";
import { pfetch } from "./proxy";

interface IbgeMunicipio { id: number; nome: string; }

async function findMunicipio(cidade: string, uf: string): Promise<IbgeMunicipio | null> {
  const res = await pfetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
  );
  if (!res.ok) return null;
  const list = (await res.json()) as IbgeMunicipio[];
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const target = norm(cidade);
  return list.find((m) => norm(m.nome) === target) ?? null;
}

async function fetchPopulacao(id: string): Promise<number | undefined> {
  try {
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${id}]`;
    const res = await pfetch(url);
    if (!res.ok) return undefined;
    const data = await res.json();
    const serie = data?.[0]?.resultados?.[0]?.series?.[0]?.serie;
    if (serie) {
      const last = Object.values(serie).pop();
      const n = Number(last);
      return Number.isFinite(n) ? n : undefined;
    }
  } catch { /* ignore */ }
  return undefined;
}

async function fetchPib(id: string): Promise<{ pib?: number; pibpc?: number }> {
  try {
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/5938/periodos/-1/variaveis/37|498?localidades=N6[${id}]`;
    const res = await pfetch(url);
    if (!res.ok) return {};
    const data = await res.json();
    const grab = (varId: string) => {
      const v = data.find((x: { id?: string }) => String(x.id) === varId);
      const serie = v?.resultados?.[0]?.series?.[0]?.serie;
      if (!serie) return undefined;
      const last = Object.values(serie).pop();
      const n = Number(last);
      return Number.isFinite(n) ? n : undefined;
    };
    const pib = grab("37");
    const pibpc = grab("498");
    return { pib: pib ? pib * 1000 : undefined, pibpc };
  } catch { return {}; }
}

export async function fetchMarketData(cidade: string, uf: string): Promise<MarketData | null> {
  if (!cidade || !uf) return null;
  const mun = await findMunicipio(cidade, uf);
  if (!mun) return { cidade, uf };
  const id = String(mun.id);
  const [populacao, pibInfo] = await Promise.all([fetchPopulacao(id), fetchPib(id)]);
  return {
    municipio_ibge_id: id,
    cidade: mun.nome,
    uf,
    populacao,
    pib_total: pibInfo.pib,
    pib_per_capita: pibInfo.pibpc,
  };
}