import { createFileRoute } from "@tanstack/react-router";
import { json, optionsResponse } from "@/lib/api-public/cors";

/**
 * Diagnóstico interno — valida se Groq e CNPJA respondem OK a partir do worker.
 * Autenticado por API key da organização (mesmo mecanismo do restante da /v1).
 * Não expõe segredos: retorna apenas boolean + status + amostra curta.
 */
export const Route = createFileRoute("/api/public/v1/_diag_ai")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async () => {
          const results: Record<string, unknown> = {};

          // 1) Groq — llama-3.3-70b-versatile
          const groqKey = process.env.GROQ_API_KEY;
          results.groq_key_present = Boolean(groqKey);
          if (groqKey) {
            const t0 = Date.now();
            try {
              const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${groqKey}`,
                },
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
              const text = await r.text();
              let parsed: unknown = null;
              try {
                const j = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
                const content = j.choices?.[0]?.message?.content ?? "";
                parsed = JSON.parse(content);
              } catch {
                /* noop */
              }
              results.groq = {
                ok: r.ok,
                status: r.status,
                latency_ms: Date.now() - t0,
                model: "llama-3.3-70b-versatile",
                sample: parsed ?? text.slice(0, 200),
              };
            } catch (e) {
              results.groq = { ok: false, error: (e as Error).message, latency_ms: Date.now() - t0 };
            }
          } else {
            results.groq = { ok: false, error: "GROQ_API_KEY ausente no ambiente" };
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
