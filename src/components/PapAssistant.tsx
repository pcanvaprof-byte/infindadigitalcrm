import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import { papChat } from "@/lib/pap-assistant.functions";
import { loadAllProspects, insertProspect } from "@/lib/prospects-api";
import { listPlanTemplates } from "@/modules/lifecycle/api";
import type { Prospect } from "@/lib/mock-prospects";
import { addReminder, bootReminders } from "@/lib/pap-reminders";

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any;
  tool_call_id?: string;
  name?: string;
  /** Apenas para exibir badge no histórico */
  display?: string;
};

const SYSTEM_PROMPT = `Você é o assistente de vendas porta-a-porta (PAP) da INFINDA.
Ajude o vendedor a cadastrar prospects, consultar a base, sugerir planos, gerar propostas, registrar visitas e criar follow-ups com lembrete, de forma rápida e objetiva, em português do Brasil.

Regras gerais:
- SEMPRE chame "search_prospects" antes de criar para evitar duplicidade por CNPJ, telefone ou nome semelhante. Se houver match plausível, confirme com o vendedor.
- Para sugerir plano, chame "list_plans" e recomende 1–2 baseando-se em porte/segmento informados; explique em 1 linha.
- Após criar/atualizar, confirme com um resumo curto e o que fazer a seguir.
- Não invente dados. Se faltar algo, pergunte.
- CNPJ é OPCIONAL. Pergunte uma vez; se o vendedor disser que não tem / não sabe / "depois", siga em frente com o telefone/whatsapp e NÃO trave o cadastro. Nunca exija CNPJ.

Fluxo de cadastro PAP (siga em ordem, uma pergunta por vez, pulando o que já foi dito):
  1) Nome da empresa (obrigatório)
  2) Nome do responsável / contato
  3) Telefone ou WhatsApp (pelo menos um — obrigatório)
  4) CNPJ (opcional — se não tiver, siga adiante)
  5) E-mail (se houver — opcional)
  6) Origem (PAP por padrão; pode ser indicação, evento, etc.)
  7) Interesse (qual produto/serviço chamou atenção)
  8) Preferências (horário de contato, canal preferido, observações da visita)
Depois chame "create_prospect" preenchendo os campos. Coloque interesse + preferências em "notes".

Follow-up:
- Quando o vendedor pedir lembrete/retorno, chame "create_followup" com prospect_id, due_at (ISO, ex.: "2026-07-01T14:00:00-03:00"), notes (o que combinar) e opcionalmente remind_before_min (minutos antes do horário para um alerta prévio, ex.: 30).
- Se faltar a data/hora, pergunte. Confirme em linguagem natural ("agendado para amanhã às 10h").`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_prospects",
      description: "Busca prospects existentes por nome da empresa, CNPJ ou telefone/whatsapp. Use ANTES de criar.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Trecho do nome, CNPJ ou telefone" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_prospect",
      description: "Cria um novo prospect no CRM. Use após coletar nome, telefone/whatsapp, e-mail (se houver), origem, interesse e preferências.",
      parameters: {
        type: "object",
        properties: {
          company: { type: "string" },
          cnpj: { type: "string" },
          owner: { type: "string", description: "Nome do responsável" },
          whatsapp: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          segment: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          source: { type: "string", description: "Origem do lead (ex.: PAP, indicação, evento). Default: PAP" },
          interest: { type: "string", description: "Produto/serviço de interesse" },
          preferences: { type: "string", description: "Horário/canal preferido e observações da visita" },
          potential: { type: "string", enum: ["alto", "medio", "baixo"] },
          notes: { type: "string", description: "Anotação inicial livre (opcional). Se ausente, será montada com interesse + preferências." },
        },
        required: ["company"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_plans",
      description: "Lista planos disponíveis com nome, código e mensalidade.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "log_visit",
      description: "Registra uma visita/observação no prospect e define próximo contato.",
      parameters: {
        type: "object",
        properties: {
          prospect_id: { type: "string" },
          notes: { type: "string" },
          next_contact_at: { type: "string", description: "Data/hora ISO (opcional)" },
        },
        required: ["prospect_id", "notes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_followup",
      description:
        "Cria uma tarefa de follow-up para o vendedor com data/hora, observações e lembrete (notificação no navegador + toast).",
      parameters: {
        type: "object",
        properties: {
          prospect_id: { type: "string", description: "ID do prospect já existente (use search_prospects para obter)." },
          due_at: { type: "string", description: "Data/hora ISO do follow-up. Ex.: 2026-07-01T14:00:00-03:00" },
          notes: { type: "string", description: "O que falar/fazer no retorno." },
          remind_before_min: {
            type: "number",
            description: "Minutos antes do horário para um alerta prévio. Opcional (ex.: 15, 30, 60).",
          },
        },
        required: ["prospect_id", "due_at", "notes"],
      },
    },
  },
];

function score(p: Prospect, q: string) {
  const n = q.toLowerCase().replace(/\D/g, "");
  const qq = q.toLowerCase();
  let s = 0;
  if (p.company?.toLowerCase().includes(qq)) s += 5;
  if (p.owner?.toLowerCase().includes(qq)) s += 3;
  const digits = (s: string) => (s || "").replace(/\D/g, "");
  if (n.length >= 4) {
    if (digits(p.cnpj || "").includes(n)) s += 6;
    if (digits(p.whatsapp).includes(n)) s += 4;
    if (digits(p.phone).includes(n)) s += 4;
  }
  return s;
}

/**
 * Alguns modelos emitem uma "tool call textual" no conteúdo
 * (ex.: `{ "action": "search_prospects", "action_input": "{...}" }`)
 * mesmo quando já retornaram tool_calls estruturados. Removemos qualquer
 * bloco JSON de ação para não vazar na conversa.
 */
function sanitizeAssistantContent(raw: string | null | undefined): string {
  if (!raw) return "";
  let out = raw;
  // Remove code fences ```json ... ``` que só contêm um "action"
  out = out.replace(/```(?:json|tool_code|tool)?\s*\{[\s\S]*?"action"[\s\S]*?\}\s*```/gi, "");
  // Remove objetos JSON soltos (não cercados por fence) contendo "action" + "action_input"
  out = out.replace(/\{\s*"action"\s*:\s*"[^"]+"\s*,\s*"action_input"\s*:\s*[\s\S]*?\}\s*/g, "");
  // Remove linhas "Thought:" / "Action:" / "Observation:" (padrão ReAct)
  out = out.replace(/^\s*(Thought|Action|Action Input|Observation)\s*:.*$/gim, "");
  return out.trim();
}

async function runTool(name: string, args: any): Promise<unknown> {
  if (name === "search_prospects") {
    const list = await loadAllProspects();
    const q = String(args?.query ?? "").trim();
    const ranked = list
      .map((p) => ({ p, s: score(p, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => ({
        id: x.p.id,
        company: x.p.company,
        cnpj: x.p.cnpj,
        owner: x.p.owner,
        whatsapp: x.p.whatsapp,
        phone: x.p.phone,
        status: x.p.status,
      }));
    return { count: ranked.length, results: ranked };
  }
  if (name === "create_prospect") {
    const composedNotes = (
      args.notes ||
      [args.interest ? `Interesse: ${args.interest}` : "", args.preferences ? `Preferências: ${args.preferences}` : ""]
        .filter(Boolean)
        .join(" | ")
    ) as string;
    const p = await insertProspect({
      company: String(args.company || "").trim(),
      cnpj: args.cnpj || "",
      segment: args.segment || "Outros",
      owner: args.owner || "",
      whatsapp: args.whatsapp || "",
      phone: args.phone || "",
      email: args.email || "",
      instagram: "",
      city: args.city || "",
      state: args.state || "",
      source: (args.source as string) || "PAP",
      potential: (args.potential as any) || "medio",
      status: "primeiro_contato",
      updatedAt: null,
      cadenceStep: 0,
      cadenceStatus: "ativo",
      responseStatus: "sem_resposta",
      lastContactAt: null,
      nextContactAt: null,
    } as any);
    if (composedNotes) {
      try {
        const { addInteractionRemote } = await import("@/lib/prospects-api");
        await addInteractionRemote(p.id, "nota", `[PAP] ${composedNotes}`, "Assistente PAP");
      } catch (e) {
        console.warn("[PAP] falha ao gravar nota inicial", e);
      }
    }
    return { ok: true, id: p.id, company: p.company };
  }
  if (name === "list_plans") {
    const plans = await listPlanTemplates();
    return plans.map((t) => ({ code: t.code, name: t.name, mensalidade: t.mensalidade }));
  }
  if (name === "log_visit") {
    const { addInteractionRemote, updateProspect } = await import("@/lib/prospects-api");
    await addInteractionRemote(args.prospect_id, "nota", `[PAP] ${args.notes}`, "Assistente PAP");
    if (args.next_contact_at) {
      await updateProspect(args.prospect_id, { nextContactAt: args.next_contact_at } as any);
    }
    return { ok: true };
  }
  if (name === "create_followup") {
    const { addInteractionRemote, updateProspect, loadAllProspects: load } = await import("@/lib/prospects-api");
    const due = String(args.due_at || "");
    if (!due || isNaN(new Date(due).getTime())) {
      return { error: "due_at inválido. Use ISO 8601 (ex.: 2026-07-01T14:00:00-03:00)." };
    }
    const all = await load();
    const target = all.find((x) => x.id === args.prospect_id);
    if (!target) return { error: "prospect_id não encontrado." };
    await addInteractionRemote(
      args.prospect_id,
      "nota",
      `[FOLLOW-UP @ ${new Date(due).toLocaleString("pt-BR")}] ${args.notes || ""}`,
      "Assistente PAP",
    );
    await updateProspect(args.prospect_id, { nextContactAt: due } as any);
    const r = await addReminder({
      prospectId: args.prospect_id,
      company: target.company,
      notes: String(args.notes || ""),
      dueAt: new Date(due).toISOString(),
      remindBeforeMin: typeof args.remind_before_min === "number" ? args.remind_before_min : undefined,
    });
    return { ok: true, reminder_id: r.id, due_at: r.dueAt, company: target.company };
  }
  return { error: `tool desconhecida: ${name}` };
}

export function PapAssistant() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  useEffect(() => {
    bootReminders();
  }, []);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Olá! Sou o assistente PAP da INFINDA. Me diga **empresa, contato e telefone** da visita e eu cadastro o lead. Posso também sugerir plano, gerar proposta ou registrar follow-up.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next: ChatMsg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setBusy(true);
    try {
      let conv: ChatMsg[] = [{ role: "system", content: SYSTEM_PROMPT }, ...next];
      for (let step = 0; step < 6; step++) {
        const reply = await papChat({
          data: { messages: conv as any, tools: TOOLS as any },
        });
        const assistantMsg: ChatMsg = {
          role: "assistant",
          content: reply.content || "",
          tool_calls: reply.tool_calls,
        };
        conv = [...conv, assistantMsg];

        if (!reply.tool_calls || reply.tool_calls.length === 0) {
          setMsgs((m) => [...m, { role: "assistant", content: sanitizeAssistantContent(reply.content) }]);
          break;
        }

        // Mostra no histórico que ferramentas foram chamadas
        const usedNames = reply.tool_calls.map((c: any) => c.function?.name).join(", ");
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: null, display: `⚙ Executando: ${usedNames}` },
        ]);

        for (const call of reply.tool_calls) {
          let parsed: any = {};
          try {
            parsed = JSON.parse(call.function?.arguments || "{}");
          } catch {
            parsed = {};
          }
          let result: unknown;
          try {
            result = await runTool(call.function.name, parsed);
          } catch (e: any) {
            result = { error: e?.message || "Falha ao executar" };
          }
          conv = [
            ...conv,
            {
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: JSON.stringify(result),
            },
          ];
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro no assistente");
      setMsgs((m) => [...m, { role: "assistant", content: `Erro: ${e?.message || "falha"}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          aria-label="Abrir assistente PAP"
          onClick={() => setOpen(true)}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30 transition hover:scale-105 sm:bottom-5 sm:right-5 sm:h-14 sm:w-14"
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden border border-border bg-background shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[600px] sm:max-h-[85vh] sm:w-[380px] sm:max-w-[95vw] sm:rounded-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Assistente PAP</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
            {msgs.map((m, i) => {
              if (m.display) {
                return (
                  <p key={i} className="text-[11px] italic text-muted-foreground">
                    {m.display}
                  </p>
                );
              }
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {m.content}
                    </div>
                  </div>
                );
              }
              if (m.role === "assistant" && m.content) {
                const clean = sanitizeAssistantContent(m.content);
                if (!clean) return null;
                return (
                  <div key={i} className="max-w-[90%] text-sm">
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                      <ReactMarkdown>{clean}</ReactMarkdown>
                    </div>
                  </div>
                );
              }
              return null;
            })}
            {busy && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Pensando…
              </p>
            )}
          </div>

          <div className="border-t border-border bg-muted/20 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ex.: Acabei de visitar a Padaria do Zé, CNPJ 12.345.678/0001-90, falei com o João (11 99999-1111)…"
                rows={2}
                disabled={busy}
                className="min-h-[44px] flex-1 resize-none text-base sm:text-sm"
              />
              <Button size="icon" className="h-11 w-11 shrink-0" onClick={send} disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}