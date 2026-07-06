import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClient, listPlanTemplates, updateClient } from "@/modules/lifecycle/api";
import { STAGE_LABEL, ORIGEM_OPTIONS, ORIGEM_LABEL } from "@/modules/lifecycle/types";
import { jsPDF } from "jspdf";

export const Route = createFileRoute("/operacoes/clientes/$id/")({
  ssr: false,
  component: ResumoPage,
});

function ResumoPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["lc-client", id], queryFn: () => getClient(id) });
  const c = q.data;
  if (!c) return null;

  const days =
    c.activated_at != null
      ? Math.floor((Date.now() - new Date(c.activated_at).getTime()) / 86400000)
      : null;

  // Calcula término previsto a partir de activated_at + contract_term_months,
  // funcionando mesmo se o banco ainda não tiver a coluna contract_end_at.
  const endDate = (() => {
    if (c.contract_end_at) return new Date(c.contract_end_at);
    if (c.activated_at && c.contract_term_months) {
      const s = new Date(c.activated_at);
      return new Date(s.getFullYear(), s.getMonth() + Number(c.contract_term_months), s.getDate());
    }
    return null;
  })();

  const mensal = Number(c.mensalidade ?? 0);
  const siteRec = Number(c.site_recurring_value ?? 0);
  const siteOne = Number(c.site_one_time_value ?? 0);
  const term = Number(c.contract_term_months ?? 0);
  const valorTotal = term > 0 ? (mensal + siteRec) * term + siteOne : null;

  const SITE_STATUS_LABEL: Record<string, string> = {
    nao_aplica: "Não se aplica",
    a_vista: "À vista",
    parcelado: "Parcelado",
    incluso: "Incluso no plano",
    pendente: "Pendente",
    pago: "Pago",
  };

  const items = [
    { label: "Plano", value: c.plano_code ?? "—" },
    {
      label: "Origem",
      value: c.origem
        ? `${ORIGEM_LABEL[c.origem] ?? c.origem}${c.origem_detalhe ? ` · ${c.origem_detalhe}` : ""}`
        : "—",
    },
    {
      label: "Mensalidade",
      value: c.mensalidade != null ? `R$ ${Number(c.mensalidade).toFixed(2)}` : "—",
    },
    { label: "Estágio", value: STAGE_LABEL[c.pipeline_stage] },
    { label: "Status financeiro", value: c.financial_status },
    { label: "Status contrato", value: c.lc_contract_status },
    { label: "Onboarding", value: c.onboarding_status },
    { label: "Cliente há", value: days != null ? `${days} dias` : "—" },
    { label: "Próxima ação", value: c.next_action_date ?? c.current_step ?? "—" },
    {
      label: "Duração",
      value: c.contract_term_months ? `${c.contract_term_months} meses` : "—",
    },
    {
      label: "Término previsto",
      value: endDate ? endDate.toLocaleDateString("pt-BR") : "—",
    },
    {
      label: "Permuta",
      value: c.is_permuta
        ? c.permuta_value != null
          ? `Sim · R$ ${Number(c.permuta_value).toFixed(2)}`
          : "Sim"
        : "Não",
    },
    {
      label: "Venda do site (única)",
      value:
        c.site_one_time_value != null
          ? `R$ ${Number(c.site_one_time_value).toFixed(2)}${
              c.site_payment_status
                ? ` · ${SITE_STATUS_LABEL[c.site_payment_status] ?? c.site_payment_status}`
                : ""
            }`
          : "—",
    },
    {
      label: "Recorrência do site",
      value:
        c.site_recurring_value != null
          ? `R$ ${Number(c.site_recurring_value).toFixed(2)}/mês`
          : "—",
    },
    {
      label: "Status pgto. site",
      value: c.site_payment_status
        ? SITE_STATUS_LABEL[c.site_payment_status] ?? c.site_payment_status
        : "—",
    },
    {
      label: "Valor total do contrato",
      value:
        valorTotal != null
          ? `R$ ${valorTotal.toFixed(2)}`
          : "—",
    },
    {
      label: "Observações",
      value: c.contract_notes ? c.contract_notes : "—",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {c.cnpj ? `CNPJ ${c.cnpj}` : "CNPJ não informado"}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => downloadFichaPDF(c, items)}>
            Baixar PDF
          </Button>
          <EditClientDialog clientId={id} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <Card key={it.label} className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{it.label}</p>
            <p className="mt-1 truncate text-sm font-medium">{String(it.value)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function EditClientDialog({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const cq = useQuery({ queryKey: ["lc-client", clientId], queryFn: () => getClient(clientId) });
  const tplQ = useQuery({ queryKey: ["lc-tpl"], queryFn: listPlanTemplates, enabled: open });

  const [form, setForm] = useState({
    company: "",
    cnpj: "",
    contact_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    plano_code: "",
    mensalidade: "",
    activated_at: "",
    financial_status: "pendente",
    lc_contract_status: "nao_gerado",
    onboarding_status: "pendente",
    contract_term_months: "",
    is_permuta: false,
    permuta_value: "",
    permuta_description: "",
    site_one_time_value: "",
    site_recurring_value: "",
    site_payment_status: "nao_aplica",
    contract_notes: "",
    origem: "",
    origem_detalhe: "",
  });

  useEffect(() => {
    if (!open || !cq.data) return;
    const c = cq.data;
    setForm({
      company: c.company ?? "",
      cnpj: c.cnpj ?? "",
      contact_name: c.contact_name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      whatsapp: c.whatsapp ?? "",
      plano_code: c.plano_code ?? "",
      mensalidade: c.mensalidade != null ? String(c.mensalidade) : "",
      activated_at: c.activated_at ? c.activated_at.slice(0, 10) : "",
      financial_status: c.financial_status ?? "pendente",
      lc_contract_status: c.lc_contract_status ?? "nao_gerado",
      onboarding_status: c.onboarding_status ?? "pendente",
      contract_term_months: c.contract_term_months != null ? String(c.contract_term_months) : "",
      is_permuta: !!c.is_permuta,
      permuta_value: c.permuta_value != null ? String(c.permuta_value) : "",
      permuta_description: c.permuta_description ?? "",
      site_one_time_value:
        c.site_one_time_value != null ? String(c.site_one_time_value) : "",
      site_recurring_value:
        c.site_recurring_value != null ? String(c.site_recurring_value) : "",
      site_payment_status: c.site_payment_status ?? "nao_aplica",
      contract_notes: c.contract_notes ?? "",
      origem: c.origem ?? "",
      origem_detalhe: c.origem_detalhe ?? "",
    });
  }, [open, cq.data]);

  const saveM = useMutation({
    mutationFn: () => {
      const term = form.contract_term_months ? Number(form.contract_term_months) : null;
      const start = form.activated_at ? new Date(form.activated_at) : null;
      const end =
        term && start
          ? new Date(start.getFullYear(), start.getMonth() + term, start.getDate()).toISOString()
          : null;
      return updateClient(clientId, {
        company: form.company.trim(),
        cnpj: form.cnpj.trim() || null,
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        plano_code: form.plano_code.trim() || null,
        mensalidade: form.mensalidade ? Number(form.mensalidade) : null,
        activated_at: form.activated_at ? new Date(form.activated_at).toISOString() : null,
        financial_status: form.financial_status as never,
        lc_contract_status: form.lc_contract_status as never,
        onboarding_status: form.onboarding_status as never,
        contract_term_months: term,
        contract_end_at: end,
        is_permuta: form.is_permuta,
        permuta_value: form.is_permuta && form.permuta_value ? Number(form.permuta_value) : null,
        permuta_description: form.is_permuta ? form.permuta_description.trim() || null : null,
        site_one_time_value: form.site_one_time_value ? Number(form.site_one_time_value) : null,
        site_recurring_value: form.site_recurring_value ? Number(form.site_recurring_value) : null,
        site_payment_status:
          form.site_one_time_value || form.site_recurring_value
            ? form.site_payment_status
            : null,
        contract_notes: form.contract_notes.trim() || null,
        origem: form.origem || null,
        origem_detalhe: form.origem_detalhe.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lc-client", clientId] });
      qc.invalidateQueries({ queryKey: ["lc-clients"] });
      toast.success("Dados atualizados");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Editar dados
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Cadastro do cliente · contrato</DialogTitle>
        </DialogHeader>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Identificação
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Empresa">
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </Field>
            <Field label="CNPJ">
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} />
            </Field>
            <Field label="Responsável">
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Contrato
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plano">
              <Select value={form.plano_code} onValueChange={(v) => {
                const tpl = (tplQ.data ?? []).find((t) => t.code === v);
                setForm({
                  ...form,
                  plano_code: v,
                  mensalidade: tpl ? String(tpl.mensalidade) : form.mensalidade,
                });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(tplQ.data ?? []).map((t) => (
                    <SelectItem key={t.code} value={t.code}>
                      {t.name} — R$ {t.mensalidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mensalidade (R$)">
              <Input
                type="number"
                inputMode="decimal"
                value={form.mensalidade}
                onChange={(e) => setForm({ ...form, mensalidade: e.target.value })}
              />
            </Field>
            <Field label="Início do contrato (ativação)">
              <Input
                type="date"
                value={form.activated_at}
                onChange={(e) => setForm({ ...form, activated_at: e.target.value })}
              />
            </Field>
            <Field label="Duração (meses)">
              <Select
                value={form.contract_term_months || "custom"}
                onValueChange={(v) =>
                  setForm({ ...form, contract_term_months: v === "custom" ? "" : v })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                  <SelectItem value="custom">Outro / sem prazo</SelectItem>
                </SelectContent>
              </Select>
              {(!["3", "6", "12", "24"].includes(form.contract_term_months)) && (
                <Input
                  className="mt-2"
                  type="number"
                  inputMode="numeric"
                  placeholder="Meses (opcional)"
                  value={form.contract_term_months}
                  onChange={(e) => setForm({ ...form, contract_term_months: e.target.value })}
                />
              )}
            </Field>
            <Field label="Status do contrato">
              <Select value={form.lc_contract_status} onValueChange={(v) => setForm({ ...form, lc_contract_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_gerado">Não gerado</SelectItem>
                  <SelectItem value="enviado">Enviado</SelectItem>
                  <SelectItem value="assinado">Assinado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status financeiro">
              <Select value={form.financial_status} onValueChange={(v) => setForm({ ...form, financial_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="recorrente">Recorrente</SelectItem>
                  <SelectItem value="inadimplente">Inadimplente</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Onboarding">
              <Select value={form.onboarding_status} onValueChange={(v) => setForm({ ...form, onboarding_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="space-y-3 rounded-md border border-dashed p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Contrato por permuta</p>
                <p className="text-xs text-muted-foreground">
                  Marque se a contrapartida é em produtos/serviços
                </p>
              </div>
              <Switch
                checked={form.is_permuta}
                onCheckedChange={(v) => setForm({ ...form, is_permuta: v })}
              />
            </div>
            {form.is_permuta && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor aproximado da permuta (R$)">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={form.permuta_value}
                    onChange={(e) => setForm({ ...form, permuta_value: e.target.value })}
                  />
                </Field>
                <Field label="Descrição da permuta">
                  <Textarea
                    rows={2}
                    value={form.permuta_description}
                    onChange={(e) => setForm({ ...form, permuta_description: e.target.value })}
                    placeholder="Ex.: 2 jantares/mês + divulgação"
                  />
                </Field>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Site / Produto adicional
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor da venda do site (R$)">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Ex.: 2500"
                value={form.site_one_time_value}
                onChange={(e) => setForm({ ...form, site_one_time_value: e.target.value })}
              />
            </Field>
            <Field label="Recorrência do site (R$/mês)">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Ex.: 150"
                value={form.site_recurring_value}
                onChange={(e) => setForm({ ...form, site_recurring_value: e.target.value })}
              />
            </Field>
            <Field label="Pagamento da venda do site">
              <Select
                value={form.site_payment_status}
                onValueChange={(v) => setForm({ ...form, site_payment_status: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_aplica">Não se aplica</SelectItem>
                  <SelectItem value="a_vista">À vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="incluso">Incluso no plano</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Outras informações
          </p>
          <Field label="Observações do contrato">
            <Textarea
              rows={3}
              value={form.contract_notes}
              onChange={(e) => setForm({ ...form, contract_notes: e.target.value })}
              placeholder="Escopo extra, condições especiais, descontos, integrações…"
            />
          </Field>
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={saveM.isPending} onClick={() => saveM.mutate()}>
            {saveM.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function downloadFichaPDF(c: any, items: { label: string; value: unknown }[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Ficha 360° — Cliente", margin, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(c.company ?? "—", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  const sub: string[] = [];
  if (c.cnpj) sub.push(`CNPJ ${c.cnpj}`);
  if (c.contact_name) sub.push(c.contact_name);
  if (c.phone) sub.push(c.phone);
  if (c.email) sub.push(c.email);
  if (sub.length) {
    doc.text(sub.join("  ·  "), margin, y);
    y += 14;
  }
  doc.setTextColor(0);
  y += 6;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo do contrato", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const colW = (pageW - margin * 2) / 2;
  items.forEach((it, i) => {
    const col = i % 2;
    const x = margin + col * colW;
    if (col === 0 && i > 0) y += 30;
    if (y > 780) {
      doc.addPage();
      y = margin;
    }
    doc.setTextColor(120);
    doc.setFontSize(8);
    doc.text(String(it.label).toUpperCase(), x, y);
    doc.setTextColor(0);
    doc.setFontSize(10);
    const val = String(it.value ?? "—");
    const lines = doc.splitTextToSize(val, colW - 10);
    doc.text(lines, x, y + 12);
  });
  y += 36;

  if (c.contract_notes) {
    if (y > 720) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Observações do contrato", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const notes = doc.splitTextToSize(String(c.contract_notes), pageW - margin * 2);
    doc.text(notes, margin, y);
  }

  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR")} · INFINDA`,
    margin,
    doc.internal.pageSize.getHeight() - 20,
  );

  const slug = (c.company ?? "cliente")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  doc.save(`ficha-360-${slug}.pdf`);
}