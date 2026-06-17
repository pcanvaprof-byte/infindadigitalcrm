import { supabase } from "@/integrations/supabase/client";
import { fetchCnpj, sanitizeCnpj } from "./cnpj";
import { fetchCep, mergeAddress } from "./cep";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type DbError = { code?: string; message?: string; details?: string };

function isSchemaCacheError(error: DbError): boolean {
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return text.includes("pgrst204") || text.includes("schema cache") || text.includes("could not find");
}

/** Lightweight enrichment: fetches CNPJ + CEP and persists ONLY the address
 *  (skips Nominatim/IBGE/score). Use to fill `bairro` in bulk quickly. */
export async function collectBairro(cnpj: string): Promise<string | null> {
  const clean = sanitizeCnpj(cnpj);
  if (clean.length !== 14) return null;
  const { data: ud } = await supabase.auth.getUser();
  const uid = ud.user?.id;
  if (!uid) throw new Error("Sessão necessária.");

  const { profile, address: cnpjAddr } = await fetchCnpj(clean);
  let address = cnpjAddr;
  try {
    const v = cnpjAddr.cep ? await fetchCep(cnpjAddr.cep) : null;
    address = mergeAddress(cnpjAddr, v);
  } catch { /* ignore */ }

  const profileRow = {
    user_id: uid,
    cnpj: profile.cnpj,
    razao_social: profile.razao_social ?? null,
    nome_fantasia: profile.nome_fantasia ?? null,
    telefone_1: profile.telefone_1 ?? null,
    telefone_2: profile.telefone_2 ?? null,
    email: profile.email ?? null,
    updated_at: new Date().toISOString(),
  };
  let { data: up, error: upErr } = await db
    .from("company_profiles")
    .upsert(profileRow, { onConflict: "user_id,cnpj" })
    .select("id")
    .single();
  if (upErr && isSchemaCacheError(upErr)) {
    const compatibleProfileRow: Record<string, unknown> = { ...profileRow };
    delete compatibleProfileRow.telefone_1;
    delete compatibleProfileRow.telefone_2;
    delete compatibleProfileRow.email;
    delete compatibleProfileRow.updated_at;
    const retry = await db
      .from("company_profiles")
      .upsert(compatibleProfileRow, { onConflict: "user_id,cnpj" })
      .select("id")
      .single();
    up = retry.data;
    upErr = retry.error;
  }
  if (upErr) throw upErr;
  const profileId = up.id as string;

  await db.from("company_addresses").delete().eq("profile_id", profileId);
  await db.from("company_addresses").insert({ user_id: uid, profile_id: profileId, ...address });
  return address.bairro ?? null;
}