/**
 * Pipeline de enriquecimento executado no SERVIDOR (cron).
 *
 * Espelha o pipeline do navegador (src/lib/enrichment/api.ts), mas sem
 * depender de sessão do usuário nem do proxy autenticado: as APIs públicas
 * são chamadas direto com fetch e a gravação usa o client admin.
 */
import { completeCnpj, sanitizeCnpj } from "./cnpj";
import { mergeAddress } from "./cep";
import { normalizeAddress } from "./normalize";
import { computeScore } from "./score";
import type {
  EnrichedAddress,
  EnrichedLocation,
  EnrichedProfile,
  MarketData,
} from "./types";

const UA = { Accept: "application/json", "User-Agent": "INFINDA-Enrichment/1.0" };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function formatPhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const d = raw.replace(/\D/g, "");
  if (d.length < 10) return undefined;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return raw;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function fetchCnpjServer(clean: string): Promise<{ profile: EnrichedProfile; address: EnrichedAddress } | null> {
  const brasil = await getJson<Any>(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
  if (brasil) {
    return {
      profile: {
        cnpj: clean,
        razao_social: brasil.razao_social,
        nome_fantasia: brasil.nome_fantasia,
        situacao: brasil.descricao_situacao_cadastral,
        data_abertura: brasil.data_inicio_atividade,
        natureza_juridica: brasil.natureza_juridica,
        porte: brasil.porte,
        capital_social: brasil.capital_social === undefined ? undefined : Number(brasil.capital_social),
        cnae_principal: brasil.cnae_fiscal ? String(brasil.cnae_fiscal) : undefined,
        cnae_principal_desc: brasil.cnae_fiscal_descricao,
        cnaes_secundarios: (brasil.cnaes_secundarios ?? []).map((c: Any) => ({
          codigo: String(c.codigo ?? ""), descricao: c.descricao ?? "",
        })),
        socios: (brasil.qsa ?? []).map((s: Any) => ({
          nome: s.nome_socio ?? "", qualificacao: s.qualificacao_socio,
        })).filter((s: Any) => s.nome),
        telefone_1: formatPhone(brasil.ddd_telefone_1),
        telefone_2: formatPhone(brasil.ddd_telefone_2),
        email: brasil.email?.toLowerCase(),
        raw: brasil,
      },
      address: {
        cep: brasil.cep, logradouro: brasil.logradouro, numero: brasil.numero,
        complemento: brasil.complemento, bairro: brasil.bairro,
        cidade: brasil.municipio, uf: brasil.uf,
      },
    };
  }

  const pub = await getJson<Any>(`https://publica.cnpj.ws/cnpj/${clean}`);
  if (!pub) return null;
  const est = pub.estabelecimento ?? {};
  return {
    profile: {
      cnpj: clean,
      razao_social: pub.razao_social,
      nome_fantasia: est.nome_fantasia,
      situacao: est.situacao_cadastral,
      data_abertura: est.data_inicio_atividade,
      natureza_juridica: pub.natureza_juridica?.descricao,
      porte: pub.porte?.descricao,
      capital_social: pub.capital_social === undefined ? undefined : Number(pub.capital_social),
      cnae_principal: est.atividade_principal?.id ? String(est.atividade_principal.id) : undefined,
      cnae_principal_desc: est.atividade_principal?.descricao,
      cnaes_secundarios: (est.atividades_secundarias ?? []).map((c: Any) => ({
        codigo: String(c.id ?? ""), descricao: c.descricao ?? "",
      })),
      socios: (pub.socios ?? []).map((s: Any) => ({
        nome: s.nome ?? "", qualificacao: s.qualificacao_socio?.descricao,
      })).filter((s: Any) => s.nome),
      telefone_1: est.ddd1 && est.telefone1 ? formatPhone(est.ddd1 + est.telefone1) : undefined,
      telefone_2: est.ddd2 && est.telefone2 ? formatPhone(est.ddd2 + est.telefone2) : undefined,
      email: est.email?.toLowerCase(),
      raw: pub,
    },
    address: {
      cep: est.cep,
      logradouro: [est.tipo_logradouro, est.logradouro].filter(Boolean).join(" ") || undefined,
      numero: est.numero, complemento: est.complemento, bairro: est.bairro,
      cidade: est.cidade?.nome, uf: est.estado?.sigla,
    },
  };
}

const REGIAO: Record<string, string> = {
  AC:"Norte",AP:"Norte",AM:"Norte",PA:"Norte",RO:"Norte",RR:"Norte",TO:"Norte",
  AL:"Nordeste",BA:"Nordeste",CE:"Nordeste",MA:"Nordeste",PB:"Nordeste",PE:"Nordeste",
  PI:"Nordeste",RN:"Nordeste",SE:"Nordeste",DF:"Centro-Oeste",GO:"Centro-Oeste",
  MT:"Centro-Oeste",MS:"Centro-Oeste",ES:"Sudeste",MG:"Sudeste",RJ:"Sudeste",
  SP:"Sudeste",PR:"Sul",RS:"Sul",SC:"Sul",
};

async function fetchCepServer(cep?: string): Promise<EnrichedAddress | null> {
  const clean = (cep ?? "").replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const d = await getJson<Any>(`https://viacep.com.br/ws/${clean}/json/`);
  if (!d || d.erro) return null;
  return {
    cep: clean, logradouro: d.logradouro, bairro: d.bairro,
    cidade: d.localidade, uf: d.uf, regiao: d.uf ? REGIAO[d.uf] : undefined,
  };
}

async function geocodeServer(addr: EnrichedAddress): Promise<EnrichedLocation | null> {
  const q = [
    addr.logradouro && addr.numero ? `${addr.logradouro}, ${addr.numero}` : addr.logradouro,
    addr.bairro, addr.cidade, addr.uf, addr.cep, "Brasil",
  ].filter(Boolean).join(", ");
  if (!q) return null;
  const arr = await getJson<Any[]>(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
  );
  if (!arr?.length) return null;
  return { lat: Number(arr[0].lat), lon: Number(arr[0].lon), display_name: arr[0].display_name };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BatchResult {
  processed: number;
  ok: number;
  failed: number;
  pending: number;
  details: { cnpj: string; status: "done" | "error"; message?: string }[];
}

interface PendingLead {
  id: string;
  user_id: string;
  cnpj: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  segment: string | null;
}

function isPlaceholderCompany(company?: string | null): boolean {
  const c = (company ?? "").trim();
  if (!c) return true;
  return sanitizeCnpj(c) === c.replace(/\s|[.\-/]/g, "");
}

/** Enriquece até `limit` leads pendentes (sem cidade/UF definidas). */
export async function enrichPendingBatch(limit = 20): Promise<BatchResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: candidates, error } = await db
    .from("prospects")
    .select("id,user_id,cnpj,company,city,state,phone,whatsapp,email,segment")
    .not("cnpj", "is", null)
    .or("city.is.null,state.is.null")
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);

  const list: PendingLead[] = (candidates ?? []).filter((p: PendingLead) => sanitizeCnpj(p.cnpj ?? "").length >= 8);

  // Remove os que já possuem perfil salvo (enriquecimento é compartilhado).
  const cnpjs = Array.from(new Set(list.map((p) => completeCnpj(p.cnpj ?? "")).filter((c) => c.length === 14)));
  const already = new Set<string>();
  if (cnpjs.length) {
    const { data: profiles } = await db
      .from("company_profiles")
      .select("cnpj")
      .in("cnpj", cnpjs.slice(0, 300));
    for (const row of profiles ?? []) already.add(row.cnpj as string);
  }

  const queue = list.filter((p) => !already.has(completeCnpj(p.cnpj ?? "")));
  const batch = queue.slice(0, limit);

  const result: BatchResult = {
    processed: batch.length, ok: 0, failed: 0,
    pending: Math.max(queue.length - batch.length, 0), details: [],
  };

  for (const lead of batch) {
    const clean = completeCnpj(lead.cnpj ?? "");
    try {
      if (clean.length !== 14) throw new Error("CNPJ inválido");
      const fetched = await fetchCnpjServer(clean);
      if (!fetched) throw new Error("Receita indisponível");
      const { profile } = fetched;

      const viacep = await fetchCepServer(fetched.address.cep);
      const address = normalizeAddress(mergeAddress(fetched.address, viacep)).address;
      const location = await geocodeServer(address);

      let market: MarketData | null = null;
      if (address.cidade && address.uf) {
        const { data: md } = await db
          .from("company_market_data")
          .select("*")
          .eq("cidade", address.cidade)
          .eq("uf", address.uf)
          .limit(1)
          .maybeSingle();
        if (md) {
          market = {
            municipio_ibge_id: md.municipio_ibge_id, cidade: md.cidade, uf: md.uf,
            populacao: md.populacao ? Number(md.populacao) : undefined,
            pib_total: md.pib_total ? Number(md.pib_total) : undefined,
            pib_per_capita: md.pib_per_capita ? Number(md.pib_per_capita) : undefined,
            idh: md.idh ? Number(md.idh) : undefined,
          };
        }
      }

      const score = computeScore(profile, market, location);
      const uid = lead.user_id;

      const { data: up, error: upErr } = await db
        .from("company_profiles")
        .upsert({
          user_id: uid,
          prospect_id: lead.id,
          cnpj: profile.cnpj,
          razao_social: profile.razao_social ?? null,
          nome_fantasia: profile.nome_fantasia ?? null,
          situacao: profile.situacao ?? null,
          data_abertura: profile.data_abertura ?? null,
          natureza_juridica: profile.natureza_juridica ?? null,
          porte: profile.porte ?? null,
          capital_social: profile.capital_social ?? null,
          cnae_principal: profile.cnae_principal ?? null,
          cnae_principal_desc: profile.cnae_principal_desc ?? null,
          cnaes_secundarios: profile.cnaes_secundarios ?? [],
          socios: profile.socios ?? [],
          telefone_1: profile.telefone_1 ?? null,
          telefone_2: profile.telefone_2 ?? null,
          email: profile.email ?? null,
          raw: profile.raw ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,cnpj" })
        .select("id")
        .single();
      if (upErr) throw new Error(upErr.message);
      const profileId = up.id as string;

      await db.from("company_addresses").delete().eq("profile_id", profileId);
      await db.from("company_addresses").insert({ user_id: uid, profile_id: profileId, ...address });
      if (location) {
        await db.from("company_locations").delete().eq("profile_id", profileId);
        await db.from("company_locations").insert({
          user_id: uid, profile_id: profileId,
          lat: location.lat, lon: location.lon, display_name: location.display_name ?? null,
        });
      }
      await db.from("company_scores").insert({
        user_id: uid, profile_id: profileId,
        lead_score: score.lead_score, market_score: score.market_score,
        classificacao: score.classificacao, breakdown: score.breakdown,
      });

      // Sincroniza de volta no lead (só campos vazios).
      const patch: Record<string, string> = {};
      const tel = profile.telefone_1 || profile.telefone_2;
      if (!lead.phone && tel) patch.phone = tel;
      if (!lead.whatsapp && tel) patch.whatsapp = tel;
      if (!lead.email && profile.email) patch.email = profile.email;
      if (!lead.city && address.cidade) patch.city = address.cidade;
      if (!lead.state && address.uf) patch.state = address.uf;
      const nome = profile.nome_fantasia?.trim() || profile.razao_social?.trim();
      if (nome && isPlaceholderCompany(lead.company)) patch.company = nome;
      if ((!lead.segment || lead.segment === "Outros") && profile.cnae_principal_desc) {
        patch.segment = profile.cnae_principal_desc;
      }
      if (sanitizeCnpj(lead.cnpj ?? "") !== clean) patch.cnpj = clean;
      if (Object.keys(patch).length) {
        const { error: updErr } = await db.from("prospects").update(patch).eq("id", lead.id);
        if (updErr && patch.cnpj) {
          const { cnpj: _drop, ...rest } = patch;
          if (Object.keys(rest).length) await db.from("prospects").update(rest).eq("id", lead.id);
        }
      }

      await db.from("company_enrichment_logs").insert({
        user_id: uid, profile_id: profileId, cnpj: clean,
        step: "persist", status: "done", message: "cron", payload: null,
      });
      result.ok += 1;
      result.details.push({ cnpj: clean, status: "done" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "erro";
      result.failed += 1;
      result.details.push({ cnpj: clean, status: "error", message });
      try {
        await db.from("company_enrichment_logs").insert({
          user_id: lead.user_id, profile_id: null, cnpj: clean,
          step: "persist", status: "error", message: `cron: ${message}`,
        });
      } catch { /* ignore */ }
    }
    await sleep(1100);
  }

  return result;
}

export interface EnrichmentStats {
  enriched: number;
  last24h: number;
  last7d: number;
  pending: number;
  lastRunAt: string | null;
  errors24h: number;
}

export async function enrichmentStats(): Promise<EnrichmentStats> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const iso = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

  const count = async (table: string, apply: (q: Any) => Any) => {
    const { count } = await apply(db.from(table).select("*", { count: "exact", head: true }));
    return count ?? 0;
  };

  const [enriched, last24h, last7d, pending, errors24h] = await Promise.all([
    count("company_profiles", (q: Any) => q),
    count("company_profiles", (q: Any) => q.gte("updated_at", iso(24))),
    count("company_profiles", (q: Any) => q.gte("updated_at", iso(24 * 7))),
    count("prospects", (q: Any) => q.not("cnpj", "is", null).or("city.is.null,state.is.null")),
    count("company_enrichment_logs", (q: Any) => q.eq("status", "error").gte("created_at", iso(24))),
  ]);

  const { data: last } = await db
    .from("company_enrichment_logs")
    .select("created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    enriched, last24h, last7d, pending,
    errors24h,
    lastRunAt: last?.created_at ?? null,
  };
}
