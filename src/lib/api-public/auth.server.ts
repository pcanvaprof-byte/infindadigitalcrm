import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { errorJson, optionsResponse } from "./cors";
import { extractBearer, hashApiKey, isValidKeyFormat } from "./keys.server";

export type ApiCtx = {
  keyId: string;
  orgId: string;
  createdBy: string;
  admin: SupabaseClient<Database>;
};

function serviceClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function auditLog(
  admin: SupabaseClient<Database>,
  params: {
    apiKeyId: string | null;
    orgId: string | null;
    endpoint: string;
    method: string;
    status: number;
    ip: string | null;
    ua: string | null;
  },
) {
  if (!params.orgId) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("api_key_audit_log").insert({
    api_key_id: params.apiKeyId,
    organization_id: params.orgId,
    endpoint: params.endpoint,
    method: params.method,
    status: params.status,
    ip: params.ip,
    user_agent: params.ua,
  });
}

/**
 * Authenticates an API request via Bearer token, executes the handler, and
 * writes an audit log entry. Handles OPTIONS preflight automatically.
 */
export async function withApiAuth(
  request: Request,
  handler: (ctx: ApiCtx) => Promise<Response>,
): Promise<Response> {
  if (request.method === "OPTIONS") return optionsResponse();

  const url = new URL(request.url);
  const endpoint = url.pathname;
  const method = request.method;
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ua = request.headers.get("user-agent");

  const token = extractBearer(request);
  if (!token || !isValidKeyFormat(token)) {
    return errorJson(401, "unauthorized", "Missing or malformed API key. Send header: Authorization: Bearer infd_live_...");
  }

  let admin: SupabaseClient<Database>;
  try {
    admin = serviceClient();
  } catch {
    return errorJson(500, "server_misconfigured", "API backend not configured.");
  }

  const keyHash = hashApiKey(token);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: keyRow, error } = await (admin as any)
    .from("api_keys")
    .select("id, organization_id, created_by, revoked_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !keyRow || keyRow.revoked_at) {
    await auditLog(admin, {
      apiKeyId: keyRow?.id ?? null,
      orgId: keyRow?.organization_id ?? null,
      endpoint,
      method,
      status: 401,
      ip,
      ua,
    });
    return errorJson(401, "invalid_key", "API key is invalid or has been revoked.");
  }

  // Fire-and-forget: update last_used_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (admin as any)
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  let response: Response;
  try {
    response = await handler({
      keyId: keyRow.id,
      orgId: keyRow.organization_id,
      createdBy: keyRow.created_by,
      admin,
    });
  } catch (err) {
    console.error("[api-public] handler error", err);
    response = errorJson(500, "internal_error", "Unexpected server error.");
  }

  void auditLog(admin, {
    apiKeyId: keyRow.id,
    orgId: keyRow.organization_id,
    endpoint,
    method,
    status: response.status,
    ip,
    ua,
  });

  return response;
}