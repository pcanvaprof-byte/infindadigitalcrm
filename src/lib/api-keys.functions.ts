import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateApiKey } from "./api-public/keys.server";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_by: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeOrg } = await (context.supabase as any)
      .from("user_active_org").select("organization_id").eq("user_id", context.userId).maybeSingle();
    if (!activeOrg?.organization_id) return { keys: [] as ApiKeyRow[] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from("api_keys")
      .select("id, name, prefix, created_by, last_used_at, revoked_at, created_at")
      .eq("organization_id", activeOrg.organization_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { keys: (data ?? []) as ApiKeyRow[] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: activeOrg } = await (context.supabase as any)
      .from("user_active_org").select("organization_id").eq("user_id", context.userId).maybeSingle();
    if (!activeOrg?.organization_id) throw new Error("Sem organização ativa.");

    const { fullKey, prefix, keyHash } = generateApiKey();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (context.supabase as any)
      .from("api_keys")
      .insert({
        organization_id: activeOrg.organization_id,
        created_by: context.userId,
        name: data.name,
        prefix,
        key_hash: keyHash,
      })
      .select("id, name, prefix, created_at")
      .single();
    if (error) throw new Error(error.message);

    return { key: row, full_key: fullKey };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (context.supabase as any)
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });