// Cliente Groq com rotação automática de chaves e fallback Lovable AI.
// Usar apenas dentro de handlers de server functions ou rotas API.

type Msg = { role: "system" | "user" | "assistant"; content: string };

export type GroqCallOptions = {
  model: string;
  messages: Msg[];
  temperature?: number;
  jsonMode?: boolean;
  fallbackModel?: string; // modelo usado no Lovable AI Gateway (default: google/gemini-2.5-flash)
};

function getGroqKeys(): string[] {
  const keys = [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ].filter((k): k is string => typeof k === "string" && k.length > 0);
  return keys;
}

async function callGroqWith(
  key: string,
  opts: GroqCallOptions,
): Promise<{ ok: true; content: string } | { ok: false; status: number; body: string }> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.4,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, status: res.status, body: body.slice(0, 300) };
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return { ok: true, content: json.choices?.[0]?.message?.content?.trim() ?? "" };
}

async function callLovableFallback(opts: GroqCallOptions): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) {
    throw new Error("Nenhuma chave de IA disponível (GROQ_API_KEY/GROQ_API_KEY_2 e LOVABLE_API_KEY ausentes)");
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableKey,
    },
    body: JSON.stringify({
      model: opts.fallbackModel ?? "google/gemini-2.5-flash",
      temperature: opts.temperature ?? 0.4,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: opts.messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`IA indisponível (Lovable ${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Chama a API Groq com rotação automática entre múltiplas chaves.
 * Se todas as chaves Groq falharem (rate limit/erro), cai para o Lovable AI Gateway.
 * Lança erro apenas se todas as opções estiverem indisponíveis.
 */
export async function callGroqChat(opts: GroqCallOptions): Promise<string> {
  const keys = getGroqKeys();
  let lastErr: { status: number; body: string } | null = null;

  for (const key of keys) {
    try {
      const result = await callGroqWith(key, opts);
      if (result.ok) return result.content;
      lastErr = { status: result.status, body: result.body };
      // Se não é rate-limit/erro transiente, ainda tenta próxima chave
      // (invalidez pode ser específica de uma chave)
      console.warn(`[groq] chave falhou (${result.status}), tentando próxima`);
    } catch (err) {
      console.warn("[groq] erro de rede, tentando próxima chave:", err);
      lastErr = { status: 0, body: String(err).slice(0, 200) };
    }
  }

  // Todas as chaves Groq falharam → fallback Lovable
  console.warn("[groq] todas as chaves falharam, usando fallback Lovable AI", lastErr);
  return callLovableFallback(opts);
}