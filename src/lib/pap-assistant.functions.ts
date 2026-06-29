import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Message = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().nullable().optional(),
  tool_calls: z.any().optional(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

const Input = z.object({
  messages: z.array(Message).min(1),
  tools: z.array(z.any()).optional(),
});

/**
 * Proxy server-side para o assistente PAP.
 * Mantém LOVABLE_API_KEY no servidor; cliente roda o loop de tool-calling.
 */
export const papChat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente no servidor.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: data.messages,
        tools: data.tools,
        tool_choice: data.tools && data.tools.length ? "auto" : undefined,
      }),
    });

    if (res.status === 429) {
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    }
    if (res.status === 402) {
      throw new Error("Créditos da IA esgotados. Adicione créditos para continuar.");
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`IA falhou (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const choice = json?.choices?.[0]?.message;
    return {
      role: "assistant" as const,
      content: (choice?.content ?? "") as string,
      tool_calls: choice?.tool_calls ?? null,
    };
  });