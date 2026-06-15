import { supabase } from "@/integrations/supabase/client";
import { fetchCnpj, sanitizeCnpj } from "./cnpj";
import { fetchCep, mergeAddress } from "./cep";
import { geocode } from "./geo";
import { fetchMarketData } from "./ibge";
import { computeScore } from "./score";
import type {
  EnrichmentResult,
  EnrichmentStep,
  EnrichedProfile,
  EnrichedAddress,
  EnrichedLocation,
  MarketData,
  ScoreResult,
  CompanyVisit,
} from "./types";

type StepStatus = "pending" | "running" | "done" | "error" | "skipped";
export interface StepEvent {
  step: EnrichmentStep;
  label: string;
  status: StepStatus;
  message?: string;
}

export const STEPS: { id: EnrichmentStep; label: string }[] = [
  { id: "cnpj", label: "Receita Federal" },
  { id: "cep", label: "ViaCEP" },
  { id: "geo", label: "Geolocalização" },
  { id: "ibge", label: "Indicadores IBGE" },
  { id: "score", label: "Cálculo de Score" },
  { id: "persist", label: "Salvando" },
];

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function log(
  uid: string,
  profileId: string | null,
  cnpj: string,
  step: EnrichmentStep,
  status: StepStatus,
  message?: string,
  payload?: unknown,
) {
  try {
    await db.from("company_enrichment_logs").insert({
      user_id: uid,
      profile_id: profileId,
      cnpj,
      step,
      status,
      message: message ?? null,
      payload: payload ?? null,
    });
  } catch { /* ignore */ }
}

export async function loadExistingEnrichment(
  cnpj: string,
): Promise<EnrichmentResult | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const clean = sanitizeCnpj(cnpj);
  const { data: profile } = await db
    .from("company_profiles")
    .select("*")
    .eq("user_id", uid)
    .eq("cnpj", clean)
    .maybeSingle();
  if (!profile) return null;
  const [{ data: addr }, { data: loc }, { data: market }, { data: score }] = await Promise.all([
    db.from("company_addresses").select("*").eq("profile_id", profile.id).maybeSingle(),
    db.from("company_locations").select("*").eq("profile_id", profile.id).maybeSingle(),
    db.from("company_market_data").select("*").eq("user_id", uid)
      .eq("cidade", profile.raw?.municipio ?? "").maybeSingle(),
    db.from("company_scores").select("*").eq("profile_id", profile.id)
      .order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const result: EnrichmentResult = {
    profile: {
      cnpj: profile.cnpj,
      razao_social: profile.razao_social,
      nome_fantasia: profile.nome_fantasia,
      situacao: profile.situacao,
      data_abertura: profile.data_abertura,
      natureza_juridica: profile.natureza_juridica,
      porte: profile.porte,
      capital_social: profile.capital_social ? Number(profile.capital_social) : undefined,
      cnae_principal: profile.cnae_principal,
      cnae_principal_desc: profile.cnae_principal_desc,
      cnaes_secundarios: profile.cnaes_secundarios ?? [],
      socios: profile.socios ?? [],
      telefone_1: profile.telefone_1 ?? undefined,
      telefone_2: profile.telefone_2 ?? undefined,
      email: profile.email ?? undefined,
    },
    address: addr ? {
      cep: addr.cep, logradouro: addr.logradouro, numero: addr.numero,
      complemento: addr.complemento, bairro: addr.bairro,
      cidade: addr.cidade, uf: addr.uf, regiao: addr.regiao,
    } : undefined,
    location: loc ? { lat: Number(loc.lat), lon: Number(loc.lon), display_name: loc.display_name } : undefined,
    market: market ? {
      municipio_ibge_id: market.municipio_ibge_id,
      cidade: market.cidade, uf: market.uf,
      populacao: market.populacao ? Number(market.populacao) : undefined,
      pib_total: market.pib_total ? Number(market.pib_total) : undefined,
      pib_per_capita: market.pib_per_capita ? Number(market.pib_per_capita) : undefined,
      idh: market.idh ? Number(market.idh) : undefined,
    } : undefined,
    score: score ? {
      lead_score: score.lead_score, market_score: score.market_score,
      classificacao: score.classificacao, breakdown: score.breakdown,
    } : computeScore({ cnpj: profile.cnpj }, null, null),
  };
  result.visits = await listVisits(profile.id);
  return result;
}

export interface RunOptions {
  prospectId?: string;
  onStep?: (e: StepEvent) => void;
}

function emit(opts: RunOptions, step: EnrichmentStep, status: StepStatus, message?: string) {
  const label = STEPS.find((s) => s.id === step)?.label ?? step;
  opts.onStep?.({ step, label, status, message });
}

export async function runEnrichment(
  cnpj: string,
  opts: RunOptions = {},
): Promise<EnrichmentResult> {
  const clean = sanitizeCnpj(cnpj);
  if (clean.length !== 14) throw new Error("CNPJ inválido (14 dígitos).");
  const uid = await currentUserId();

  // 1) CNPJ
  emit(opts, "cnpj", "running");
  const { profile, address: cnpjAddress } = await fetchCnpj(clean);
  emit(opts, "cnpj", "done");

  // 2) CEP
  emit(opts, "cep", "running");
  let address: EnrichedAddress = cnpjAddress;
  try {
    const viacep = cnpjAddress.cep ? await fetchCep(cnpjAddress.cep) : null;
    address = mergeAddress(cnpjAddress, viacep);
    emit(opts, "cep", viacep ? "done" : "skipped", viacep ? undefined : "CEP não normalizado");
  } catch (e) {
    emit(opts, "cep", "error", (e as Error).message);
  }

  // 3) Geo
  emit(opts, "geo", "running");
  let location: EnrichedLocation | undefined;
  try {
    const g = await geocode(address);
    if (g) location = g;
    emit(opts, "geo", g ? "done" : "skipped");
  } catch (e) {
    emit(opts, "geo", "error", (e as Error).message);
  }

  // 4) IBGE
  emit(opts, "ibge", "running");
  let market: MarketData | undefined;
  try {
    if (address.cidade && address.uf) {
      const m = await fetchMarketData(address.cidade, address.uf);
      if (m) market = m;
    }
    emit(opts, "ibge", market ? "done" : "skipped");
  } catch (e) {
    emit(opts, "ibge", "error", (e as Error).message);
  }

  // 5) Score
  emit(opts, "score", "running");
  const score: ScoreResult = computeScore(profile, market ?? null, location ?? null);
  emit(opts, "score", "done", `${score.lead_score} pts · ${score.classificacao}`);

  // 6) Persist
  if (uid) {
    emit(opts, "persist", "running");
    try {
      const profileRow = {
        user_id: uid,
        prospect_id: opts.prospectId ?? null,
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
      };
      const { data: up, error: upErr } = await db
        .from("company_profiles")
        .upsert(profileRow, { onConflict: "user_id,cnpj" })
        .select()
        .single();
      if (upErr) throw upErr;
      const profileId = up.id as string;

      await db.from("company_addresses").delete().eq("profile_id", profileId);
      await db.from("company_addresses").insert({
        user_id: uid, profile_id: profileId, ...address,
      });
      if (location) {
        await db.from("company_locations").delete().eq("profile_id", profileId);
        await db.from("company_locations").insert({
          user_id: uid, profile_id: profileId,
          lat: location.lat, lon: location.lon, display_name: location.display_name ?? null,
        });
      }
      if (market?.municipio_ibge_id) {
        await db.from("company_market_data").upsert(
          { user_id: uid, ...market },
          { onConflict: "user_id,municipio_ibge_id" },
        );
      }
      await db.from("company_scores").insert({
        user_id: uid, profile_id: profileId,
        lead_score: score.lead_score, market_score: score.market_score,
        classificacao: score.classificacao, breakdown: score.breakdown,
      });
      await log(uid, profileId, profile.cnpj, "persist", "done");
      emit(opts, "persist", "done");
    } catch (e) {
      await log(uid, null, profile.cnpj, "persist", "error", (e as Error).message);
      emit(opts, "persist", "error", (e as Error).message);
    }
  } else {
    emit(opts, "persist", "skipped", "Sem sessão Cloud — dados não foram salvos.");
  }

  return { profile, address, location, market, score };
}