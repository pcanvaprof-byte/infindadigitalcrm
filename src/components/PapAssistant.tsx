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
Ajude o vendedor a cadastrar prospects, consultar a base, sugerir planos, gerar propostas e registrar visitas/follow-ups, de forma rápida e objetiva, em português do Brasil.

Regras:
- Pergunte apenas o essencial. Campos mínimos para cadastrar: empresa e (whatsapp OU telefone). CNPJ, responsável, segmento, cidade/UF são desejáveis mas opcionais.
- SEMPRE chame "search_prospects" antes de criar para evitar duplicidade por CNPJ, telefone ou nome semelhante. Se houver match plausível, confirme com o vendedor.
- Para sugerir plano, chame "list_plans" e recomende 1–2 baseando-se em porte/segmento informados; explique em 1 linha.
- Para registrar uma visita ou follow-up, chame "log_visit" com observações curtas e o próximo contato (ISO date opcional).
- Após criar/atualizar, confirme com um resumo curto e o que fazer a seguir.
- Não invente dados. Se faltar algo, pergunte.`;

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
      description: "Cria um novo prospect no CRM.",
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
          potential: { type: "string", enum: ["alto", "medio", "baixo"] },
          notes: { type: "string", description: "Anotação inicial da visita PAP (opcional)" },
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
      source: "PAP",
      potential: (args.potential as any) || "medio",
      status: "primeiro_contato",
      updatedAt: null,
      cadenceStep: 0,
      cadenceStatus: "ativo",
      responseStatus: "sem_resposta",
      lastContactAt: null,
      nextContactAt: null,
    } as any);
    return { ok: true, id: p.id, company: p.company };
  }
  if (name === "list_plans") {
    const plans = await listPlanTemplates();
    return plans.map((t) => ({ code: t.code, name: t.name, mensalidade: t.mensalidade }));
  }
  if (name === "log_visit") {
    const { addInteractionRemote, updateProspect } = await import("@/lib/prospects-api");
    await addInteractionRemote(args.prospect_id, {
      kind: "nota",
      text: `[PAP] ${args.notes}`,
      by: "Assistente PAP",
    } as any);
    if (args.next_contact_at) {
      await updateProspect(args.prospect_id, { nextContactAt: args.next_contact_at } as any);
    }
    return { ok: true };
  }
  return { error: `tool desconhecida: ${name}` };
}

export function PapAssistant() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
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
          setMsgs((m) => [...m, { role: "assistant", content: reply.content || "" }]);
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
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30 transition hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[600px] max-h-[85vh] w-[380px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Assistente PAP</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
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
                return (
                  <div key={i} className="max-w-[90%] text-sm">
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
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

          <div className="border-t border-border bg-muted/20 p-2">
            <div className="flex gap-2">
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
                className="resize-none text-sm"
              />
              <Button size="icon" onClick={send} disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}