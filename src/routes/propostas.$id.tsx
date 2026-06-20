import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  getProposal, listItems, listEvents, listVersions,
  addItemFromCatalog, removeItem, updateItem, saveVersion,
  getCurrentVersion, updateProposal, registerSend,
  propostasKeys, buildPublicUrl,
} from "@/lib/propostas/api";
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_TONE, type ProposalContent } from "@/lib/propostas/types";
import { listItems as listCatalogItems, listCategorias } from "@/lib/catalog/api";
import { COBRANCA_LABEL, formatBRL } from "@/lib/catalog/types";
import {
  Copy, ExternalLink, Plus, Save, Send, Trash2,
  History, FileText, MessageCircle, Mail, Link as LinkIcon, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { gerarConteudoProposta } from "@/lib/propostas/ai.functions";

export const Route = createFileRoute("/propostas/$id")({
  head: () => ({ meta: [{ title: "Editor de Proposta — INFINDA" }] }),
  component: () => (
    <RequireAuth>
      <EditorPage />
    </RequireAuth>
  ),
});

function EditorPage() {
  const { id } = useParams({ from: "/propostas/$id" });
  const qc = useQueryClient();

  const propQ = useQuery({ queryKey: propostasKeys.one(id), queryFn: () => getProposal(id) });
  const itemsQ = useQuery({ queryKey: propostasKeys.items(id), queryFn: () => listItems(id) });
  const versionQ = useQuery({ queryKey: ["propostas", id, "current-version"], queryFn: () => getCurrentVersion(id) });
  const eventsQ = useQuery({ queryKey: propostasKeys.events(id), queryFn: () => listEvents(id) });
  const versionsQ = useQuery({ queryKey: propostasKeys.versions(id), queryFn: () => listVersions(id) });

  const [content, setContent] = useState<ProposalContent>({});
  const [titulo, setTitulo] = useState("");
  const [validade, setValidade] = useState(7);
  const [addOpen, setAddOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [aiContext, setAiContext] = useState("");

  const gerarFn = useServerFn(gerarConteudoProposta);
  const gerar = useMutation({
    mutationFn: async () =>
      gerarFn({ data: { proposalId: id, contexto: aiContext || undefined } }),
    onSuccess: (out) => {
      setContent({ ...content, ...out.content });
      if (out.source === "fallback") {
        toast.warning(
          `Conteúdo gerado por modelo determinístico (motivo: ${out.rejected_reason ?? "—"}). Revise antes de salvar.`,
        );
      } else {
        toast.success(
          `Conteúdo gerado pela IA (${out.attempts} tentativa${out.attempts > 1 ? "s" : ""}). Revise e clique em Salvar versão.`,
        );
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    if (propQ.data) {
      setTitulo(propQ.data.titulo);
      setValidade(propQ.data.validade_dias);
    }
  }, [propQ.data]);

  useEffect(() => {
    if (versionQ.data?.conteudo_json) setContent(versionQ.data.conteudo_json);
  }, [versionQ.data]);

  const p = propQ.data;
  const items = itemsQ.data ?? [];

  const saveDraft = useMutation({
    mutationFn: async () => {
      await updateProposal(id, { titulo, validade_dias: validade });
      await saveVersion(id, content);
    },
    onSuccess: async () => {
      toast.success("Versão salva");
      await qc.invalidateQueries({ queryKey: propostasKeys.one(id) });
      await qc.invalidateQueries({ queryKey: ["propostas", id, "current-version"] });
      await qc.invalidateQueries({ queryKey: propostasKeys.versions(id) });
      await qc.invalidateQueries({ queryKey: propostasKeys.events(id) });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (propQ.isLoading) {
    return <AppShell title="Carregando…"><p className="py-12 text-center text-xs text-muted-foreground">Carregando…</p></AppShell>;
  }
  if (!p) {
    return <AppShell title="Não encontrada"><p className="py-12 text-center text-xs text-muted-foreground">Proposta não encontrada.</p></AppShell>;
  }

  const publicUrl = buildPublicUrl(p.token_publico);

  return (
    <AppShell
      title={p.numero}
      subtitle={p.titulo}
      actions={
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-1 text-[10px] font-medium ${PROPOSAL_STATUS_TONE[p.status]}`}>
            {PROPOSAL_STATUS_LABEL[p.status]}
          </span>
          <Button variant="outline" size="sm" className="h-8" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
            <Save className="mr-1 h-3.5 w-3.5" /> Salvar versão
          </Button>
          <Button className="btn-gradient h-8 text-xs" onClick={() => setSendOpen(true)}>
            <Send className="mr-1 h-3.5 w-3.5" /> Enviar
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-4 lg:col-span-2">
          {/* Cabeçalho herdado */}
          <div className="surface-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dados herdados do CRM
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <Info label="Título"><Input className="h-8" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Info>
              <Info label="Validade (dias)">
                <Input className="h-8" type="number" value={validade}
                       onChange={(e) => setValidade(Number(e.target.value) || 7)} />
              </Info>
              <Info label="Link público">
                <div className="flex items-center gap-1">
                  <Input className="h-8" readOnly value={publicUrl} />
                  <Button size="sm" variant="outline" className="h-8 shrink-0"
                          onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <a href={publicUrl} target="_blank" rel="noreferrer"
                     className="rounded border border-border p-2 hover:bg-accent"><ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
              </Info>
              <Info label="Token"><Input className="h-8 font-mono text-xs" readOnly value={p.token_publico} /></Info>
            </div>
          </div>

          {/* Escopo / Itens */}
          <div className="surface-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Escopo dos serviços
              </p>
              <Button size="sm" className="btn-gradient h-8 text-xs" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar item
              </Button>
            </div>
            {items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Nenhum item ainda. Adicione produtos do Catálogo Comercial.
              </p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">Item</th>
                    <th className="px-2 py-1 text-left">Cobrança</th>
                    <th className="px-2 py-1 text-right">Qtd</th>
                    <th className="px-2 py-1 text-right">Unitário</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-b border-border/40">
                      <td className="px-2 py-2">
                        <p className="font-medium">{it.nome}</p>
                        {it.descricao && <p className="text-[11px] text-muted-foreground line-clamp-2">{it.descricao}</p>}
                      </td>
                      <td className="px-2 py-2 text-xs">{COBRANCA_LABEL[it.cobranca as keyof typeof COBRANCA_LABEL]}</td>
                      <td className="px-2 py-2 text-right">
                        <Input type="number" min={1} step={1} className="h-7 w-16 text-right text-xs"
                               value={it.quantidade}
                               onChange={(e) => {
                                 const v = Number(e.target.value) || 1;
                                 updateItem(it.id, { quantidade: v, valor_unitario: it.valor_unitario })
                                   .then(() => qc.invalidateQueries({ queryKey: propostasKeys.items(id) }))
                                   .then(() => qc.invalidateQueries({ queryKey: propostasKeys.one(id) }));
                               }} />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input type="number" min={0} step={0.01} className="h-7 w-24 text-right text-xs"
                               value={it.valor_unitario}
                               onChange={(e) => {
                                 const v = Number(e.target.value) || 0;
                                 updateItem(it.id, { quantidade: it.quantidade, valor_unitario: v })
                                   .then(() => qc.invalidateQueries({ queryKey: propostasKeys.items(id) }))
                                   .then(() => qc.invalidateQueries({ queryKey: propostasKeys.one(id) }));
                               }} />
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-semibold">{formatBRL(it.valor_total)}</td>
                      <td className="px-2 py-2 text-right">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                onClick={() => {
                                  removeItem(it.id)
                                    .then(() => qc.invalidateQueries({ queryKey: propostasKeys.items(id) }))
                                    .then(() => qc.invalidateQueries({ queryKey: propostasKeys.one(id) }));
                                }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border text-xs">
                    <td colSpan={4} className="px-2 py-2 text-right font-semibold">Implantação</td>
                    <td className="px-2 py-2 text-right font-bold">{formatBRL(p.valor_implantacao)}</td>
                    <td></td>
                  </tr>
                  <tr className="text-xs">
                    <td colSpan={4} className="px-2 py-1 text-right font-semibold">Mensal</td>
                    <td className="px-2 py-1 text-right font-bold">{formatBRL(p.valor_mensal)}/mês</td>
                    <td></td>
                  </tr>
                  <tr className="text-xs">
                    <td colSpan={4} className="px-2 py-1 text-right font-semibold">Total 12 meses</td>
                    <td className="px-2 py-1 text-right font-bold text-primary">
                      {formatBRL(p.valor_implantacao + p.valor_mensal * 12)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Conteúdo da proposta */}
          <div className="surface-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Conteúdo da proposta (versão atual)
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => gerar.mutate()}
                disabled={gerar.isPending}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                {gerar.isPending ? "Gerando…" : "Gerar com IA"}
              </Button>
            </div>
            <Textarea
              className="mb-3 text-xs"
              placeholder="Contexto opcional para a IA (ex: cliente prefere abordagem técnica, urgência alta, etc.)"
              value={aiContext}
              onChange={(e) => setAiContext(e.target.value)}
              rows={2}
            />
            <div className="space-y-3">
              <Field label="Sobre o cenário atual" value={content.diagnostico ?? ""}
                     onChange={(v) => setContent({ ...content, diagnostico: v })} />
              <Field label="Problemas identificados (um por linha)" value={(content.problemas ?? []).join("\n")}
                     onChange={(v) => setContent({ ...content, problemas: v.split("\n").filter(Boolean) })} />
              <Field label="Solução proposta" value={content.solucao ?? ""}
                     onChange={(v) => setContent({ ...content, solucao: v })} />
              <Field label="Cronograma" value={content.cronograma ?? ""}
                     onChange={(v) => setContent({ ...content, cronograma: v })} />
              <Field label="Observações" value={content.observacoes ?? ""}
                     onChange={(v) => setContent({ ...content, observacoes: v })} />
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Clique em <strong>Salvar versão</strong> no topo para registrar uma nova V. Versões anteriores ficam preservadas no histórico.
            </p>
          </div>
        </div>

        {/* Sidebar: histórico + timeline */}
        <div className="space-y-4">
          <div className="surface-card p-4">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Versões
            </p>
            <ul className="space-y-1 text-xs">
              {(versionsQ.data ?? []).map((v) => (
                <li key={v.id} className={`rounded px-2 py-1 ${v.id === p.current_version_id ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                  V{v.version_number} — {new Date(v.created_at).toLocaleString("pt-BR")}
                </li>
              ))}
              {(versionsQ.data ?? []).length === 0 && (
                <li className="text-muted-foreground">Nenhuma versão ainda.</li>
              )}
            </ul>
          </div>

          <div className="surface-card p-4">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Timeline
            </p>
            <ul className="space-y-2 text-xs">
              {(eventsQ.data ?? []).map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70" />
                  <div className="flex-1">
                    <p className="font-medium">{e.tipo.replaceAll("_", " ")}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")} · {e.actor_type}
                    </p>
                  </div>
                </li>
              ))}
              {(eventsQ.data ?? []).length === 0 && (
                <li className="text-muted-foreground">Sem eventos ainda.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <AddItemDialog open={addOpen} onClose={() => setAddOpen(false)}
                     proposalId={id} currentCount={items.length}
                     onAdded={() => {
                       qc.invalidateQueries({ queryKey: propostasKeys.items(id) });
                       qc.invalidateQueries({ queryKey: propostasKeys.one(id) });
                     }} />
      <SendDialog open={sendOpen} onClose={() => setSendOpen(false)} proposalId={id} url={publicUrl} />
    </AppShell>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <Textarea className="mt-1 min-h-[80px] text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AddItemDialog({
  open, onClose, proposalId, currentCount, onAdded,
}: { open: boolean; onClose: () => void; proposalId: string; currentCount: number; onAdded: () => void }) {
  const itemsQ = useQuery({ queryKey: ["catalog", "items"], queryFn: () => listCatalogItems({ apenasAtivos: true }), enabled: open });
  const catsQ = useQuery({ queryKey: ["catalog", "cats"], queryFn: listCategorias, enabled: open });
  const [search, setSearch] = useState("");

  const catMap = useMemo(() => {
    const m = new Map<string, string>();
    (catsQ.data ?? []).forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [catsQ.data]);

  const filtered = useMemo(() => {
    const list = itemsQ.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((it) =>
      it.nome_comercial.toLowerCase().includes(q) ||
      (it.descricao_curta ?? "").toLowerCase().includes(q),
    );
  }, [itemsQ.data, search]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar item do Catálogo</DialogTitle>
        </DialogHeader>
        <Input placeholder="Buscar item…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
        <div className="max-h-[420px] overflow-y-auto">
          {itemsQ.isLoading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Carregando catálogo…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Nenhum item encontrado.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((it) => {
                const preco = it.cobranca === "mensal" ? it.valor_mensal : it.cobranca === "avulso" ? it.valor_avulso : it.valor_implantacao;
                return (
                  <li key={it.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{it.nome_comercial}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {catMap.get(it.categoria_id ?? "") ?? "Sem categoria"} · {COBRANCA_LABEL[it.cobranca]} · {formatBRL(preco)}
                      </p>
                    </div>
                    <Button size="sm" className="h-7 text-xs"
                            onClick={() => {
                              addItemFromCatalog(proposalId, {
                                id: it.id,
                                nome_comercial: it.nome_comercial,
                                descricao_curta: it.descricao_curta,
                                categoria_nome: catMap.get(it.categoria_id ?? "") ?? null,
                                area_responsavel: it.area_responsavel,
                                cobranca: it.cobranca,
                                valor_implantacao: it.valor_implantacao,
                                valor_mensal: it.valor_mensal,
                                valor_avulso: it.valor_avulso,
                                prazo_estimado_dias: it.prazo_estimado_dias,
                                entregaveis: it.entregaveis,
                              }, currentCount).then(() => {
                                toast.success(`${it.nome_comercial} adicionado`);
                                onAdded();
                              }).catch((e) => toast.error(e.message));
                            }}>
                      <Plus className="mr-1 h-3 w-3" /> Adicionar
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendDialog({ open, onClose, proposalId, url }: { open: boolean; onClose: () => void; proposalId: string; url: string }) {
  const qc = useQueryClient();
  const [destino, setDestino] = useState("");
  const [mensagem, setMensagem] = useState(
    `Olá,\n\nConforme nossa reunião, segue sua proposta personalizada para análise:\n${url}\n\nFico à disposição para esclarecer qualquer dúvida.`,
  );

  const send = async (canal: "link" | "whatsapp" | "email") => {
    try {
      await registerSend(proposalId, canal, destino || undefined, mensagem);
      toast.success("Envio registrado");
      await qc.invalidateQueries({ queryKey: propostasKeys.events(proposalId) });
      await qc.invalidateQueries({ queryKey: propostasKeys.one(proposalId) });
      if (canal === "whatsapp") {
        const phone = destino.replace(/\D/g, "");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`, "_blank");
      } else if (canal === "email") {
        window.open(`mailto:${destino}?subject=${encodeURIComponent("Sua proposta INFINDA")}&body=${encodeURIComponent(mensagem)}`);
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado");
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar proposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Destino (telefone / email)</p>
            <Input className="mt-1 h-9" placeholder="ex. 5511999998888 ou cliente@empresa.com"
                   value={destino} onChange={(e) => setDestino(e.target.value)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Mensagem</p>
            <Textarea className="mt-1 min-h-[120px] text-sm" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => send("link")}><LinkIcon className="mr-1.5 h-3.5 w-3.5" /> Copiar link</Button>
          <Button variant="outline" onClick={() => send("whatsapp")} disabled={!destino}><MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp</Button>
          <Button className="btn-gradient" onClick={() => send("email")} disabled={!destino}><Mail className="mr-1.5 h-3.5 w-3.5" /> E-mail</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}