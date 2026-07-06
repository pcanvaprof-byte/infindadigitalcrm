import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED = [
  "brasilapi.com.br",
  "publica.cnpj.ws",
  "receitaws.com.br",
  "viacep.com.br",
  "nominatim.openstreetmap.org",
  "servicodados.ibge.gov.br",
];

export const proxyFetchExternal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    const u = new URL(input.url);
    if (!ALLOWED.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) {
      throw new Error(`Host não permitido: ${u.hostname}`);
    }
    return { url: u.toString() };
  })
  .handler(async ({ data }) => {
    try {
      const r = await fetch(data.url, {
        headers: { Accept: "application/json", "User-Agent": "INFINDA-Enrichment/1.0" },
      });
      const text = await r.text();
      return { ok: r.ok, status: r.status, body: text };
    } catch (e) {
      return { ok: false, status: 0, body: "", error: (e as Error).message };
    }
  });
