import { createHash, randomBytes } from "node:crypto";

const PREFIX = "infd_live_";

export function generateApiKey(): { fullKey: string; prefix: string; keyHash: string } {
  const raw = randomBytes(32).toString("base64url"); // ~43 chars
  const fullKey = `${PREFIX}${raw}`;
  const prefix = fullKey.slice(0, 16); // "infd_live_xxxxxx"
  const keyHash = hashApiKey(fullKey);
  return { fullKey, prefix, keyHash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function isValidKeyFormat(key: string): boolean {
  return key.startsWith(PREFIX) && key.length >= PREFIX.length + 20;
}