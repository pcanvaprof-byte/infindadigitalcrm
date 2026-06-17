import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ token: z.string().min(8) });

/**
 * Gera o resumo executivo IA do briefing identificado por token público.
 * Usa LOVABLE_API_KEY (server-only) e salva via RPC set_briefing_resumo_ia.
 */
export const gerarResumoBriefing = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY ausente");

    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.OWN_SB_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.OWN_SB_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error("Supabase server env ausente");

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await admin
      .from("briefings")
      .select("cliente_nome, empresa, servico, tipo, respostas_json")
      .eq("token_publico", data.token)
      .limit(1);
    if (error) throw error;
    const briefing = rows?.[0];
    if (!briefing) throw new Error("Briefing não encontrado");

    const isKickoff = briefing.tipo === "kickoff_producao";
    const promptComercial = `Você é um consultor estratégico da INFINDA Digital.
Analise as respostas do briefing abaixo e gere um resumo executivo curto e objetivo, em português, organizado nestes itens:

1. Resumo da empresa
2. Objetivo principal
3. Público-alvo
4. Principais dores
5. Principais oportunidades
6. Escopo recomendado
7. Serviços recomendados
8. Próximos passos

Cliente: ${briefing.cliente_nome ?? "-"}
Empresa: ${briefing.empresa ?? "-"}
Serviço: ${briefing.servico}

Respostas:
${JSON.stringify(briefing.respostas_json, null, 2)}`;

    const promptKickoff = `Você é o gestor de produção da INFINDA Digital.
Analise o kickoff abaixo e gere um Resumo Operacional em português, organizado nestes itens:

1. Escopo contratado
2. Acessos recebidos (liste apenas os preenchidos)
3. Materiais recebidos (liste apenas os preenchidos)
4. Pendências (campos obrigatórios faltantes ou acessos vazios)
5. Riscos identificados
6. Checklist operacional (5–8 itens objetivos, em bullets)
7. Próximos passos imediatos (equipe de produção)

Cliente: ${briefing.cliente_nome ?? "-"}
Empresa: ${briefing.empresa ?? "-"}
Serviço contratado: ${briefing.servico}

Respostas do kickoff:
${JSON.stringify(briefing.respostas_json, null, 2)}`;

    const prompt = isKickoff ? promptKickoff : promptComercial;
    const systemMsg = isKickoff
      ? "Você é gestor de produção sênior. Seja conciso, prático e direto."
      : "Você é um consultor estratégico sênior. Seja conciso e direto.";

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const resumo = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!resumo) throw new Error("Resposta IA vazia");

    const { error: upErr } = await admin.rpc("set_briefing_resumo_ia", {
      p_token: data.token,
      p_resumo: resumo,
    });
    if (upErr) throw upErr;

    // Automações pós-conclusão (status + atividades) agora ficam dentro
    // do RPC set_briefing_resumo_ia (ver migration 20260620 Fase 1).

    return { resumo };
  });