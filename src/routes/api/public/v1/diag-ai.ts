import { createFileRoute } from "@tanstack/react-router";
import { json, optionsResponse } from "@/lib/api-public/cors";

/**
 * Diagnóstico interno — valida se Groq e CNPJA respondem OK a partir do worker.
 * Autenticado por API key da organização (mesmo mecanismo do restante da /v1).
 * Não expõe segredos: retorna apenas boolean + status + amostra curta.
 */
export const Route = createFileRoute("/api/public/v1/diag-ai")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async () => {
          const results: Record<string, unknown> = {};

          // 1) Testa cada chave Groq individualmente + fallback Lovable
          const keyEnvs = ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3"] as const;
          const perKey: Record<string, unknown> = {};
          for (const envName of keyEnvs) {
            const key = process.env[envName];
            if (!key) {
              perKey[envName] = { present: false };
              continue;
            }
            const t0 = Date.now();
            try {
              const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
                body: JSON.stringify({
                  model: "llama-3.3-70b-versatile",
                  temperature: 0,
                  response_format: { type: "json_object" },
                  messages: [
                    { role: "system", content: "Responda somente JSON." },
                    { role: "user", content: 'Retorne {"ok": true, "n": 42}.' },
                  ],
                }),
              });
              perKey[envName] = { present: true, ok: r.ok, status: r.status, latency_ms: Date.now() - t0 };
            } catch (e) {
              perKey[envName] = { present: true, ok: false, error: (e as Error).message, latency_ms: Date.now() - t0 };
            }
          }
          results.groq_keys = perKey;

          // Fallback Lovable AI Gateway
          const lovableKey = process.env.LOVABLE_API_KEY;
          if (lovableKey) {
            const t0 = Date.now();
            try {
              const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  temperature: 0,
                  messages: [{ role: "user", content: "Responda apenas OK." }],
                }),
              });
              results.lovable_fallback = { present: true, ok: r.ok, status: r.status, latency_ms: Date.now() - t0 };
            } catch (e) {
              results.lovable_fallback = { present: true, ok: false, error: (e as Error).message };
            }
          } else {
            results.lovable_fallback = { present: false };
          }

          // Chamada real via helper (o que os usuários usam)
          try {
            const { callGroqChat } = await import("@/lib/ai/groq-client.server");
            const t0 = Date.now();
            const content = await callGroqChat({
              model: "llama-3.3-70b-versatile",
              temperature: 0,
              jsonMode: true,
              messages: [
                { role: "system", content: "Responda somente JSON." },
                { role: "user", content: 'Retorne {"ok": true}.' },
              ],
            });
            results.helper_call = { ok: true, latency_ms: Date.now() - t0, sample: content.slice(0, 120) };
          } catch (e) {
            results.helper_call = { ok: false, error: (e as Error).message };
          }

          // 2) CNPJA — enriquecimento de leads (CNPJ público da Petrobras: 33.000.167/0001-01)
          const cnpjaToken = process.env.CNPJA_API_TOKEN;
          results.cnpja_key_present = Boolean(cnpjaToken);
          if (cnpjaToken) {
            const t0 = Date.now();
            try {
              const r = await fetch("https://api.cnpja.com/office/33000167000101", {
                headers: { Authorization: cnpjaToken },
              });
              const text = await r.text();
              let name: string | undefined;
              try {
                name = (JSON.parse(text) as { company?: { name?: string } }).company?.name;
              } catch {
                /* noop */
              }
              results.cnpja = {
                ok: r.ok,
                status: r.status,
                latency_ms: Date.now() - t0,
                sample_company_name: name ?? text.slice(0, 200),
              };
            } catch (e) {
              results.cnpja = { ok: false, error: (e as Error).message, latency_ms: Date.now() - t0 };
            }
          } else {
            results.cnpja = { ok: false, error: "CNPJA_API_TOKEN ausente no ambiente" };
          }

          return json({ ok: true, results });
      },
    },
  },
});
