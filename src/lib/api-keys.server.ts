import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export function createOwnSupabaseAdminClient(): SupabaseClient<Database> {
  const url = process.env.OWN_SB_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.OWN_SB_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Backend da API não configurado para gravar chaves.");
  }

  return createClient<Database>(url, serviceKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveActiveOrg(supabase: any): Promise<string | null> {
  const { data, error } = await supabase.rpc("ensure_current_user_membership");
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}