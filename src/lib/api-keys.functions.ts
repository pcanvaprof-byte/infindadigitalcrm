import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/app-auth-middleware";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_by: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveActiveOrg(supabase: any, userId: string): Promise<string | null> {
  const { data: active } = await supabase
    .from("user_active_org").select("organization_id").eq("user_id", userId).maybeSingle();
  if (active?.organization_id) return active.organization_id as string;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = (membership?.organization_id as string | undefined) ?? null;
  if (orgId) {
    await supabase
      .from("user_active_org")
      .upsert({ user_id: userId, organization_id: orgId }, { onConflict: "user_id" });
  }
  return orgId;
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await resolveActiveOrg(context.supabase, context.userId);
    if (!orgId) return { keys: [] as ApiKeyRow[] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (context.supabase as any)
      .from("api_keys")
      .select("id, name, prefix, created_by, last_used_at, revoked_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { keys: (data ?? []) as ApiKeyRow[] };
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const orgId = await resolveActiveOrg(context.supabase, context.userId);
    if (!orgId) {
      throw new Error(
        "Você ainda não pertence a nenhuma organização. Crie ou entre em uma organização antes de gerar chaves de API.",
      );
    }

    const { generateApiKey } = await import("./api-public/keys.server");
    const { fullKey, prefix, keyHash } = generateApiKey();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (context.supabase as any)
      .from("api_keys")
      .insert({
        organization_id: orgId,
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