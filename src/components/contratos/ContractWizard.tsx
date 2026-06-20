import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  FileText,
  Building2,
  User,
  CreditCard,
  ClipboardList,
  Scale,
  CheckSquare,
  PartyPopper,
  Sparkles,
  ShieldCheck,
  Calendar,
  Mail,
  Phone,
  Loader2,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  contratosKeys,
  finalizarContrato,
  getContrato,
  logEvento,
  updateContrato,
} from "@/lib/contratos/api";
import {
  CONTRATO_STATUS_LABEL,
  CONTRATO_STATUS_TONE,
  type Aceites,
  type AssinaturaTipo,
  type Contrato,
  type DadosBancarios,
  type DadosPessoa,
  type DadosPessoaPF,
  type DadosPessoaPJ,
  type EscopoItem,
  type MetodoPagamento,
  type TipoPessoa,
} from "@/lib/contratos/types";
import { formatBRL } from "@/lib/catalog/types";
import { getProposal, listItems } from "@/lib/propostas/api";
import { detectServices, buildDynamicCopy } from "@/lib/proposta/viewModel/serviceProfile";
import { SignaturePad } from "./SignaturePad";

/* ---------------- Stepper ---------------- */

type StepKey =
  | "info"
  | "contratante"
  | "financeiro"
  | "escopo"
  | "condicoes"
  | "aceites"
  | "assinatura"
  | "conclusao";

const STEPS: { key: StepKey; label: string; icon: typeof FileText }[] = [
  { key: "info", label: "Informações", icon: FileText },
  { key: "contratante", label: "Contratante", icon: User },
  { key: "financeiro", label: "Financeiro", icon: CreditCard },
  { key: "escopo", label: "Escopo", icon: ClipboardList },
  { key: "condicoes", label: "Condições", icon: Scale },
  { key: "aceites", label: "Aceites", icon: CheckSquare },
  { key: "assinatura", label: "Assinatura", icon: FileSignature },
  { key: "conclusao", label: "Conclusão", icon: PartyPopper },
];

/* ---------------- Wizard root ---------------- */

export function ContractWizard({ contratoId }: { contratoId: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();

  const contratoQ = useQuery({
    queryKey: contratosKeys.one(contratoId),
    queryFn: () => getContrato(contratoId),
  });

  const propostaQ = useQuery({
    queryKey: ["propostas", contratoQ.data?.proposal_id, "for-contrato"],
    queryFn: () => getProposal(contratoQ.data!.proposal_id),
    enabled: !!contratoQ.data?.proposal_id,
  });

  const itensQ = useQuery({
    queryKey: ["propostas", contratoQ.data?.proposal_id, "items-for-contrato"],
    queryFn: () => listItems(contratoQ.data!.proposal_id),
    enabled: !!contratoQ.data?.proposal_id,
  });

  const [step, setStep] = useState<StepKey>("info");
  const [draft, setDraft] = useState<Contrato | null>(null);

  useEffect(() => {
    if (contratoQ.data) {
      setDraft(contratoQ.data);
      if (
        contratoQ.data.status === "aguardando_formalizacao" &&
        !contratoQ.data.assinado_em
      ) {
        // marca como "em preenchimento" silenciosamente
        void updateContrato(contratoQ.data.id, { status: "em_preenchimento" }).catch(() => {});
      }
      if (contratoQ.data.status === "assinado" || contratoQ.data.status === "ativo") {
        setStep("conclusao");
      }
    }
  }, [contratoQ.data]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Contrato>) => {
      await updateContrato(contratoId, patch);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contratosKeys.one(contratoId) }),
    onError: (e) => toast.error((e as Error).message),
  });

  if (contratoQ.isLoading || !draft) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const proposta = propostaQ.data;
  const itens = itensQ.data ?? [];
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  function patchDraft(patch: Partial<Contrato>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function persist(patch: Partial<Contrato>, evt?: string) {
    patchDraft(patch);
    await save.mutateAsync(patch);
    if (evt) await logEvento(contratoId, evt).catch(() => {});
  }

  function go(next: number) {
    const target = STEPS[Math.max(0, Math.min(STEPS.length - 1, next))];
    setStep(target.key);
  }

  /* ---------- Header sticky ---------- */
  const headerInfo = [
    { label: "Proposta", value: proposta?.numero ?? "—" },
    {
      label: "Cliente",
      value:
        (draft.dados_pessoa as DadosPessoaPJ)?.razao_social ||
        (draft.dados_pessoa as DadosPessoaPF)?.nome ||
        proposta?.titulo ||
        "—",
    },
    { label: "Implantação", value: formatBRL(draft.valor_implantacao) },
    { label: "Mensalidade", value: `${formatBRL(draft.valor_mensal)}/mês` },
    { label: "Data", value: new Date(draft.created_at).toLocaleDateString("pt-BR") },
  ];

  return (
    <div className="space-y-5">
      {/* Top card: identificação */}
      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-[var(--gradient-primary)]/10 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--gradient-primary)] text-primary-foreground shadow">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Contrato
              </p>
              <p className="font-mono text-sm font-semibold">{draft.numero}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${CONTRATO_STATUS_TONE[draft.status]}`}
          >
            <ShieldCheck className="h-3 w-3" />
            {CONTRATO_STATUS_LABEL[draft.status]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-5 sm:px-5">
          {headerInfo.map((i) => (
            <div key={i.label}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {i.label}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold">{i.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stepper */}
      <Stepper current={stepIdx} onStep={(i) => setStep(STEPS[i].key)} />

      {/* Step body */}
      <div className="surface-card p-5 sm:p-7">
        {step === "info" && (
          <StepInfo proposta={proposta} itens={itens} draft={draft} />
        )}
        {step === "contratante" && (
          <StepContratante draft={draft} onPersist={persist} />
        )}
        {step === "financeiro" && (
          <StepFinanceiro draft={draft} onPersist={persist} />
        )}
        {step === "escopo" && (
          <StepEscopo
            draft={draft}
            itens={itens}
            onPersist={persist}
          />
        )}
        {step === "condicoes" && (
          <StepCondicoes draft={draft} />
        )}
        {step === "aceites" && (
          <StepAceites draft={draft} onPersist={persist} />
        )}
        {step === "assinatura" && (
          <StepAssinatura
            draft={draft}
            onAfter={(updated) => {
              setDraft(updated);
              setStep("conclusao");
              qc.invalidateQueries({ queryKey: contratosKeys.all });
            }}
          />
        )}
        {step === "conclusao" && (
          <StepConclusao
            draft={draft}
            onGoList={() => nav({ to: "/contratos" })}
            onGoKickoff={() => nav({ to: "/kickoff" })}
          />
        )}
      </div>

      {/* Footer nav */}
      {step !== "conclusao" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            disabled={stepIdx === 0}
            onClick={() => go(stepIdx - 1)}
            className="h-10"
          >
            <ChevronLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Etapa {stepIdx + 1} de {STEPS.length}
          </p>
          {step !== "assinatura" && (
            <Button
              className="btn-gradient h-10"
              disabled={!canAdvance(step, draft)}
              onClick={() => go(stepIdx + 1)}
            >
              Avançar <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          )}
          {step === "assinatura" && <span />}
        </div>
      )}
    </div>
  );
}

function canAdvance(step: StepKey, d: Contrato): boolean {
  if (step === "contratante") return !!d.tipo_pessoa;
  if (step === "financeiro") return !!d.metodo_pagamento && !!d.dia_vencimento;
  if (step === "aceites") {
    const a = d.aceites ?? {};
    return !!(a.leu_contrato && a.concorda_condicoes && a.dados_corretos && a.autoriza_assinatura);
  }
  return true;
}

/* ---------------- Stepper ---------------- */

function Stepper({ current, onStep }: { current: number; onStep: (i: number) => void }) {
  return (
    <div className="surface-card px-3 py-3 sm:px-5">
      <ol className="flex w-full items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === current;
          const done = i < current;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-1">
              <button
                type="button"
                onClick={() => onStep(i)}
                className={`group flex min-w-max items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                  active
                    ? "bg-[var(--gradient-primary)] text-primary-foreground shadow"
                    : done
                      ? "text-emerald-300 hover:bg-accent/40"
                      : "text-muted-foreground hover:bg-accent/40"
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${
                    active
                      ? "bg-white/20"
                      : done
                        ? "bg-emerald-500/20"
                        : "bg-border"
                  }`}
                >
                  {done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span className={`h-px flex-1 ${done ? "bg-emerald-500/40" : "bg-border/60"}`} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- Steps ---------------- */

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof FileText; title: string; subtitle?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--gradient-primary)]/15 text-primary-glow">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}

/* --- 1. Informações --- */
function StepInfo({
  proposta,
  itens,
  draft,
}: {
  proposta: Awaited<ReturnType<typeof getProposal>> | undefined;
  itens: Awaited<ReturnType<typeof listItems>>;
  draft: Contrato;
}) {
  const profile = useMemo(
    () =>
      detectServices(
        (itens ?? []).map((i) => ({ nome: i.nome, categoria: i.categoria, descricao: i.descricao })),
      ),
    [itens],
  );
  return (
    <div>
      <SectionTitle
        icon={FileText}
        title="Informações gerais"
        subtitle="Resumo automático da proposta aprovada — valores não editáveis aqui."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card label="Número da proposta" value={proposta?.numero ?? "—"} />
        <Card label="Título" value={proposta?.titulo ?? "—"} />
        <Card label="Data da proposta" value={proposta ? new Date(proposta.created_at).toLocaleDateString("pt-BR") : "—"} />
        <Card label="Validade" value={proposta?.valid_until ? new Date(proposta.valid_until).toLocaleDateString("pt-BR") : "—"} />
        <Card label="Implantação" value={formatBRL(draft.valor_implantacao)} highlight />
        <Card label="Mensalidade" value={`${formatBRL(draft.valor_mensal)}/mês`} highlight />
        <Card label="Prazo mínimo" value={`${draft.prazo_minimo_meses} meses`} />
        <Card
          label="Prazo estimado de implantação"
          value={`${draft.prazo_implantacao_dias ?? 30} dias`}
        />
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Frentes contratadas
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.rotulos.length > 0 ? (
            profile.rotulos.map((r) => (
              <span key={r} className="rounded-full bg-accent/60 px-3 py-1 text-[11px] font-medium">
                {r}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Nenhuma frente identificada.</span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-2">
        {itens.map((it) => (
          <div
            key={it.id}
            className="flex items-center justify-between rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 text-xs"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{it.nome}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {it.cobranca} · qtd {it.quantidade}
              </p>
            </div>
            <p className="ml-3 shrink-0 font-mono text-xs font-semibold">
              {formatBRL(it.valor_total)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border border-border/60 px-3 py-2.5 ${highlight ? "bg-[var(--gradient-primary)]/10" : "bg-card/40"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${highlight ? "text-primary-glow" : ""}`}>
        {value}
      </p>
    </div>
  );
}

/* --- 2. Contratante --- */
function StepContratante({
  draft,
  onPersist,
}: {
  draft: Contrato;
  onPersist: (p: Partial<Contrato>, evt?: string) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoPessoa>(draft.tipo_pessoa ?? "pj");
  const [d, setD] = useState<DadosPessoa>(draft.dados_pessoa ?? {});

  function setField(k: string, v: string) {
    setD((prev) => ({ ...(prev as Record<string, unknown>), [k]: v }) as DadosPessoa);
  }

  async function save() {
    await onPersist({ tipo_pessoa: tipo, dados_pessoa: d }, "evt_contratante_salvo");
    toast.success("Dados do contratante salvos");
  }

  return (
    <div>
      <SectionTitle
        icon={User}
        title="Dados do contratante"
        subtitle="Identifique a pessoa física ou jurídica responsável pelo contrato."
      />

      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setTipo("pj")}
          className={`flex-1 rounded-lg border px-4 py-3 text-left transition-all ${
            tipo === "pj"
              ? "border-primary bg-[var(--gradient-primary)]/15 shadow"
              : "border-border bg-card/40 hover:bg-accent/30"
          }`}
        >
          <Building2 className="mb-1 h-4 w-4 text-primary-glow" />
          <p className="text-sm font-semibold">Pessoa Jurídica</p>
          <p className="text-[11px] text-muted-foreground">Empresa, CNPJ, responsável legal</p>
        </button>
        <button
          onClick={() => setTipo("pf")}
          className={`flex-1 rounded-lg border px-4 py-3 text-left transition-all ${
            tipo === "pf"
              ? "border-primary bg-[var(--gradient-primary)]/15 shadow"
              : "border-border bg-card/40 hover:bg-accent/30"
          }`}
        >
          <User className="mb-1 h-4 w-4 text-primary-glow" />
          <p className="text-sm font-semibold">Pessoa Física</p>
          <p className="text-[11px] text-muted-foreground">CPF, dados pessoais e endereço</p>
        </button>
      </div>

      {tipo === "pj" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Razão social">
            <Input value={(d as DadosPessoaPJ).razao_social ?? ""} onChange={(e) => setField("razao_social", e.target.value)} />
          </Field>
          <Field label="Nome fantasia">
            <Input value={(d as DadosPessoaPJ).nome_fantasia ?? ""} onChange={(e) => setField("nome_fantasia", e.target.value)} />
          </Field>
          <Field label="CNPJ">
            <Input value={(d as DadosPessoaPJ).cnpj ?? ""} onChange={(e) => setField("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Inscrição estadual">
            <Input value={(d as DadosPessoaPJ).inscricao_estadual ?? ""} onChange={(e) => setField("inscricao_estadual", e.target.value)} />
          </Field>
          <Field label="Inscrição municipal">
            <Input value={(d as DadosPessoaPJ).inscricao_municipal ?? ""} onChange={(e) => setField("inscricao_municipal", e.target.value)} />
          </Field>
          <Field label="Site">
            <Input value={(d as DadosPessoaPJ).site ?? ""} onChange={(e) => setField("site", e.target.value)} />
          </Field>
          <div className="sm:col-span-2 mt-2 rounded-lg border border-dashed border-border/60 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Responsável legal
            </p>
          </div>
          <Field label="Nome do responsável">
            <Input value={(d as DadosPessoaPJ).responsavel ?? ""} onChange={(e) => setField("responsavel", e.target.value)} />
          </Field>
          <Field label="Cargo">
            <Input value={(d as DadosPessoaPJ).cargo ?? ""} onChange={(e) => setField("cargo", e.target.value)} />
          </Field>
          <Field label="CPF do responsável">
            <Input value={(d as DadosPessoaPJ).cpf_responsavel ?? ""} onChange={(e) => setField("cpf_responsavel", e.target.value)} />
          </Field>
          <Field label="RG">
            <Input value={(d as DadosPessoaPJ).rg_responsavel ?? ""} onChange={(e) => setField("rg_responsavel", e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={(d as DadosPessoaPJ).email ?? ""} onChange={(e) => setField("email", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input value={(d as DadosPessoaPJ).telefone ?? ""} onChange={(e) => setField("telefone", e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <Input value={(d as DadosPessoaPJ).whatsapp ?? ""} onChange={(e) => setField("whatsapp", e.target.value)} />
          </Field>
          <div className="sm:col-span-2 mt-2 rounded-lg border border-dashed border-border/60 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Endereço
            </p>
          </div>
          <Field label="CEP">
            <Input value={(d as DadosPessoaPJ).cep ?? ""} onChange={(e) => setField("cep", e.target.value)} />
          </Field>
          <Field label="Endereço">
            <Input value={(d as DadosPessoaPJ).endereco ?? ""} onChange={(e) => setField("endereco", e.target.value)} />
          </Field>
          <Field label="Cidade">
            <Input value={(d as DadosPessoaPJ).cidade ?? ""} onChange={(e) => setField("cidade", e.target.value)} />
          </Field>
          <Field label="Estado (UF)">
            <Input value={(d as DadosPessoaPJ).estado ?? ""} onChange={(e) => setField("estado", e.target.value)} maxLength={2} />
          </Field>
          <Field label="Complemento">
            <Input value={(d as DadosPessoaPJ).complemento ?? ""} onChange={(e) => setField("complemento", e.target.value)} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo">
            <Input value={(d as DadosPessoaPF).nome ?? ""} onChange={(e) => setField("nome", e.target.value)} />
          </Field>
          <Field label="CPF">
            <Input value={(d as DadosPessoaPF).cpf ?? ""} onChange={(e) => setField("cpf", e.target.value)} />
          </Field>
          <Field label="RG">
            <Input value={(d as DadosPessoaPF).rg ?? ""} onChange={(e) => setField("rg", e.target.value)} />
          </Field>
          <Field label="Órgão emissor">
            <Input value={(d as DadosPessoaPF).orgao_emissor ?? ""} onChange={(e) => setField("orgao_emissor", e.target.value)} />
          </Field>
          <Field label="Estado civil">
            <Input value={(d as DadosPessoaPF).estado_civil ?? ""} onChange={(e) => setField("estado_civil", e.target.value)} />
          </Field>
          <Field label="Profissão">
            <Input value={(d as DadosPessoaPF).profissao ?? ""} onChange={(e) => setField("profissao", e.target.value)} />
          </Field>
          <Field label="Data de nascimento">
            <Input type="date" value={(d as DadosPessoaPF).nascimento ?? ""} onChange={(e) => setField("nascimento", e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={(d as DadosPessoaPF).email ?? ""} onChange={(e) => setField("email", e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input value={(d as DadosPessoaPF).telefone ?? ""} onChange={(e) => setField("telefone", e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <Input value={(d as DadosPessoaPF).whatsapp ?? ""} onChange={(e) => setField("whatsapp", e.target.value)} />
          </Field>
          <Field label="CEP">
            <Input value={(d as DadosPessoaPF).cep ?? ""} onChange={(e) => setField("cep", e.target.value)} />
          </Field>
          <Field label="Endereço">
            <Input value={(d as DadosPessoaPF).endereco ?? ""} onChange={(e) => setField("endereco", e.target.value)} />
          </Field>
          <Field label="Cidade">
            <Input value={(d as DadosPessoaPF).cidade ?? ""} onChange={(e) => setField("cidade", e.target.value)} />
          </Field>
          <Field label="Estado (UF)">
            <Input value={(d as DadosPessoaPF).estado ?? ""} onChange={(e) => setField("estado", e.target.value)} maxLength={2} />
          </Field>
          <Field label="Complemento">
            <Input value={(d as DadosPessoaPF).complemento ?? ""} onChange={(e) => setField("complemento", e.target.value)} />
          </Field>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button onClick={save} className="btn-gradient h-9 text-xs">
          Salvar dados do contratante
        </Button>
      </div>

      <p className="mt-4 rounded-lg border border-dashed border-border/60 bg-card/30 p-3 text-[11px] text-muted-foreground">
        Upload de documentos (Contrato Social, Cartão CNPJ, documento do responsável,
        comprovante de endereço) ficará disponível nesta etapa em breve.
      </p>
    </div>
  );
}

/* --- 3. Financeiro --- */
function StepFinanceiro({
  draft,
  onPersist,
}: {
  draft: Contrato;
  onPersist: (p: Partial<Contrato>, evt?: string) => Promise<void>;
}) {
  const [metodo, setMetodo] = useState<MetodoPagamento>(draft.metodo_pagamento ?? "pix");
  const [dia, setDia] = useState<number>(draft.dia_vencimento ?? 10);
  const [parc, setParc] = useState<number>(draft.parcelamento_implantacao ?? 1);
  const [obs, setObs] = useState(draft.observacoes_financeiras ?? "");
  const [bank, setBank] = useState<DadosBancarios>(draft.dados_bancarios ?? {});

  async function save() {
    await onPersist(
      {
        metodo_pagamento: metodo,
        dia_vencimento: dia,
        parcelamento_implantacao: parc,
        observacoes_financeiras: obs,
        dados_bancarios: bank,
      },
      "evt_financeiro_salvo",
    );
    toast.success("Condições financeiras salvas");
  }

  const metodos: { v: MetodoPagamento; label: string }[] = [
    { v: "pix", label: "PIX" },
    { v: "boleto", label: "Boleto" },
    { v: "cartao", label: "Cartão" },
    { v: "transferencia", label: "Transferência" },
  ];

  return (
    <div>
      <SectionTitle
        icon={CreditCard}
        title="Condições financeiras"
        subtitle="Forma de pagamento, vencimento e parcelamento da implantação."
      />
      <div className="grid gap-4">
        <Field label="Forma de pagamento">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metodos.map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setMetodo(m.v)}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                  metodo === m.v
                    ? "border-primary bg-[var(--gradient-primary)]/15 text-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-accent/40"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dia de vencimento">
            <Select value={String(dia)} onValueChange={(v) => setDia(Number(v))}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 15, 20, 25].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Dia {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Parcelamento da implantação">
            <Select value={String(parc)} onValueChange={(v) => setParc(Number(v))}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 6, 12].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}x {n > 1 ? `de ${formatBRL(draft.valor_implantacao / n)}` : "à vista"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {metodo !== "pix" && (
          <div className="rounded-lg border border-border/60 bg-card/40 p-4">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Dados bancários (opcional)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Banco">
                <Input value={bank.banco ?? ""} onChange={(e) => setBank({ ...bank, banco: e.target.value })} />
              </Field>
              <Field label="Agência">
                <Input value={bank.agencia ?? ""} onChange={(e) => setBank({ ...bank, agencia: e.target.value })} />
              </Field>
              <Field label="Conta">
                <Input value={bank.conta ?? ""} onChange={(e) => setBank({ ...bank, conta: e.target.value })} />
              </Field>
              <Field label="Chave PIX">
                <Input value={bank.pix ?? ""} onChange={(e) => setBank({ ...bank, pix: e.target.value })} />
              </Field>
            </div>
          </div>
        )}

        <Field label="Observações financeiras">
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            placeholder="Notas internas para a área financeira (opcional)"
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} className="btn-gradient h-9 text-xs">
          Salvar condições financeiras
        </Button>
      </div>
    </div>
  );
}

/* --- 4. Escopo --- */
function StepEscopo({
  draft,
  itens,
  onPersist,
}: {
  draft: Contrato;
  itens: Awaited<ReturnType<typeof listItems>>;
  onPersist: (p: Partial<Contrato>, evt?: string) => Promise<void>;
}) {
  const profile = useMemo(
    () =>
      detectServices(
        (itens ?? []).map((i) => ({ nome: i.nome, categoria: i.categoria, descricao: i.descricao })),
      ),
    [itens],
  );
  const copy = useMemo(() => buildDynamicCopy(profile), [profile]);

  const escopo: EscopoItem[] = useMemo(() => {
    return (itens ?? []).map((it) => ({
      nome: it.nome,
      cobranca: it.cobranca,
      quantidade: it.quantidade,
      valor_total: it.valor_total,
      prazo_dias: it.prazo_dias,
      entregaveis: it.entregaveis ?? [],
    }));
  }, [itens]);

  async function salvarEscopo() {
    await onPersist({ escopo }, "evt_escopo_confirmado");
    toast.success("Escopo confirmado");
  }

  return (
    <div>
      <SectionTitle
        icon={ClipboardList}
        title="Escopo contratado"
        subtitle="Detalhamento das frentes ativas neste contrato, conforme proposta aprovada."
      />

      {profile.rotulos.length > 0 && (
        <div className="mb-4 rounded-lg border border-border/60 bg-card/40 p-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Pilares do projeto
          </p>
          <ul className="space-y-1.5">
            {copy.pilares.slice(0, 5).map((p) => (
              <li key={p} className="flex items-start gap-2 text-xs">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary-glow" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {itens.map((it, idx) => (
          <div key={it.id} className="rounded-lg border border-border/60 bg-card/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold">{it.nome}</h3>
                </div>
                {it.descricao && (
                  <p className="mt-1 text-xs text-muted-foreground">{it.descricao}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-xs font-semibold">{formatBRL(it.valor_total)}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {it.cobranca}
                </p>
              </div>
            </div>
            {(it.entregaveis?.length ?? 0) > 0 && (
              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {it.entregaveis!.map((e) => (
                  <div key={`${idx}-${e}`} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary-glow" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}
            {it.prazo_dias && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/40 px-2.5 py-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" /> Prazo: {it.prazo_dias} dias
              </p>
            )}
          </div>
        ))}
        {itens.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum item registrado na proposta.</p>
        )}
      </div>

      <div className="mt-5 flex justify-end">
        <Button onClick={salvarEscopo} className="btn-gradient h-9 text-xs">
          Confirmar escopo
        </Button>
      </div>
    </div>
  );
}

/* --- 5. Condições --- */
function StepCondicoes({ draft }: { draft: Contrato }) {
  const condicoes = [
    {
      titulo: "Vigência mínima",
      texto: `Contrato com vigência mínima de ${draft.prazo_minimo_meses} (${draft.prazo_minimo_meses === 3 ? "três" : draft.prazo_minimo_meses} ) meses a partir da assinatura.`,
    },
    {
      titulo: "Renovação",
      texto:
        "Após a vigência mínima, o contrato renova-se mensalmente de forma automática, salvo manifestação contrária com 30 dias de antecedência.",
    },
    {
      titulo: "Implantação",
      texto: `Prazo estimado de implantação: ${draft.prazo_implantacao_dias ?? 30} dias úteis a contar da assinatura, conforme cronograma definido.`,
    },
    {
      titulo: "Investimento em mídia paga",
      texto:
        "Valores de mídia paga são pagos diretamente pelo CONTRATANTE às respectivas plataformas (Google, Meta, etc.) e não fazem parte do honorário deste contrato.",
    },
    {
      titulo: "Cancelamento",
      texto:
        "Cancelamento antes do término da vigência mínima implica em multa proporcional ao período remanescente, conforme cláusulas contratuais.",
    },
    {
      titulo: "LGPD e confidencialidade",
      texto:
        "Tratamento de dados conforme a Lei Geral de Proteção de Dados (LGPD). As partes comprometem-se a manter sigilo absoluto sobre as informações trocadas durante a execução.",
    },
    {
      titulo: "Propriedade intelectual",
      texto:
        "Materiais produzidos são de propriedade do CONTRATANTE após o pagamento integral. Métodos, frameworks e ferramentas internas da INFINDA permanecem de propriedade da contratada.",
    },
  ];
  return (
    <div>
      <SectionTitle
        icon={Scale}
        title="Condições contratuais"
        subtitle="Resumo das principais cláusulas. O contrato completo está disponível abaixo."
      />
      <div className="space-y-2.5">
        {condicoes.map((c) => (
          <div key={c.titulo} className="rounded-lg border border-border/60 bg-card/40 p-3.5">
            <p className="text-xs font-semibold text-primary-glow">{c.titulo}</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.texto}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 p-4">
        <div>
          <p className="text-xs font-semibold">Contrato completo</p>
          <p className="text-[11px] text-muted-foreground">
            Geração do PDF integral será habilitada após a assinatura.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9 text-xs" disabled>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Visualizar contrato completo
        </Button>
      </div>
    </div>
  );
}

/* --- 6. Aceites --- */
function StepAceites({
  draft,
  onPersist,
}: {
  draft: Contrato;
  onPersist: (p: Partial<Contrato>, evt?: string) => Promise<void>;
}) {
  const [a, setA] = useState<Aceites>(draft.aceites ?? {});

  function toggle(k: keyof Aceites) {
    const next = { ...a, [k]: !a[k] };
    setA(next);
    void onPersist({ aceites: next });
  }

  const items: { key: keyof Aceites; label: string; hint: string }[] = [
    { key: "leu_contrato", label: "Confirmo que li integralmente o contrato.", hint: "Inclui todas as cláusulas e anexos." },
    { key: "concorda_condicoes", label: "Concordo com todas as condições contratuais.", hint: "Valores, prazos, renovação e cancelamento." },
    { key: "dados_corretos", label: "Confirmo que os dados informados estão corretos.", hint: "Razão social, CNPJ, endereço e responsável legal." },
    { key: "autoriza_assinatura", label: "Autorizo a assinatura eletrônica deste contrato.", hint: "Com validade jurídica equivalente à assinatura manuscrita." },
  ];

  return (
    <div>
      <SectionTitle
        icon={CheckSquare}
        title="Aceites"
        subtitle="Confirme cada item antes de prosseguir para a assinatura."
      />
      <div className="space-y-2.5">
        {items.map((it) => (
          <label
            key={it.key}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-all ${
              a[it.key]
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border bg-card/40 hover:bg-accent/30"
            }`}
          >
            <Checkbox checked={!!a[it.key]} onCheckedChange={() => toggle(it.key)} className="mt-0.5" />
            <div>
              <p className="text-sm font-medium">{it.label}</p>
              <p className="text-[11px] text-muted-foreground">{it.hint}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

/* --- 7. Assinatura --- */
function StepAssinatura({
  draft,
  onAfter,
}: {
  draft: Contrato;
  onAfter: (updated: Contrato) => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<AssinaturaTipo>("desenhada");
  const [drawn, setDrawn] = useState<string | null>(draft.assinatura_payload);
  const [typed, setTyped] = useState("");
  const [nome, setNome] = useState(
    (draft.dados_pessoa as DadosPessoaPJ)?.responsavel ||
      (draft.dados_pessoa as DadosPessoaPF)?.nome ||
      "",
  );
  const [email, setEmail] = useState(
    (draft.dados_pessoa as DadosPessoaPF | DadosPessoaPJ)?.email ?? "",
  );

  const finalize = useMutation({
    mutationFn: async () => {
      let payload = "";
      if (tipo === "desenhada") {
        if (!drawn) throw new Error("Assine no quadro antes de finalizar.");
        payload = drawn;
      } else if (tipo === "digitada") {
        if (!typed.trim()) throw new Error("Digite o nome para assinar.");
        payload = typed.trim();
      } else {
        if (!email.trim()) throw new Error("Informe o e-mail para envio.");
        payload = `EMAIL:${email.trim()}`;
      }
      if (!nome.trim()) throw new Error("Informe o nome do signatário.");
      await finalizarContrato({ contratoId: draft.id, tipo, payload, nome: nome.trim() });
      const updated = await getContrato(draft.id);
      if (!updated) throw new Error("Contrato não encontrado após assinatura.");
      return updated;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: contratosKeys.one(draft.id) });
      toast.success("Contrato assinado com sucesso");
      onAfter(updated);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const tipos: { v: AssinaturaTipo; label: string; desc: string }[] = [
    { v: "desenhada", label: "Desenhada", desc: "Assinar com o cursor ou dedo no quadro abaixo." },
    { v: "digitada", label: "Digitada", desc: "Confirmar a assinatura digitando o nome completo." },
    { v: "email", label: "Por e-mail", desc: "Enviar para assinatura externa (DocuSign / Clicksign — em breve)." },
  ];

  return (
    <div>
      <SectionTitle
        icon={FileSignature}
        title="Assinatura eletrônica"
        subtitle="Escolha o método de assinatura. IP, data e dispositivo serão registrados."
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {tipos.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTipo(t.v)}
            disabled={t.v === "email"}
            className={`rounded-lg border px-3 py-3 text-left transition-all ${
              tipo === t.v
                ? "border-primary bg-[var(--gradient-primary)]/15"
                : "border-border bg-card/40 hover:bg-accent/30"
            } ${t.v === "email" ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <p className="text-sm font-semibold">{t.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t.desc}</p>
          </button>
        ))}
      </div>

      <Field label="Nome do signatário">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
      </Field>

      <div className="mt-4">
        {tipo === "desenhada" && <SignaturePad value={drawn} onChange={setDrawn} />}
        {tipo === "digitada" && (
          <Field label="Assinatura (digitar nome)">
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Digite seu nome completo para assinar"
              className="font-serif text-lg italic"
            />
          </Field>
        )}
        {tipo === "email" && (
          <Field label="E-mail para envio">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="signatario@empresa.com" />
          </Field>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-dashed border-border/60 p-4">
        <div className="text-[11px] text-muted-foreground">
          Data: {new Date().toLocaleString("pt-BR")}
          <br />
          Dispositivo:{" "}
          <span className="font-mono">
            {typeof navigator !== "undefined" ? navigator.userAgent.split(" ").slice(-2).join(" ") : "—"}
          </span>
        </div>
        <Button
          onClick={() => finalize.mutate()}
          disabled={finalize.isPending}
          className="btn-gradient h-10 px-6"
        >
          {finalize.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Assinando…
            </>
          ) : (
            <>
              <FileSignature className="mr-2 h-4 w-4" /> Finalizar e assinar
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* --- 8. Conclusão --- */
function StepConclusao({
  draft,
  onGoList,
  onGoKickoff,
}: {
  draft: Contrato;
  onGoList: () => void;
  onGoKickoff: () => void;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-300 ring-4 ring-emerald-500/10">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Contrato formalizado</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Recebemos sua assinatura. As próximas etapas operacionais já estão sendo preparadas.
      </p>

      <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
        <Card label="Número do contrato" value={draft.numero} highlight />
        <Card label="Status" value={CONTRATO_STATUS_LABEL[draft.status]} highlight />
        <Card
          label="Assinado em"
          value={draft.assinado_em ? new Date(draft.assinado_em).toLocaleString("pt-BR") : "—"}
        />
        <Card label="Responsável" value={draft.assinatura_nome ?? "—"} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" className="h-9 text-xs" disabled>
          <Download className="mr-1.5 h-3.5 w-3.5" /> Gerar PDF
        </Button>
        <Button variant="outline" className="h-9 text-xs" disabled>
          <Mail className="mr-1.5 h-3.5 w-3.5" /> Enviar por e-mail
        </Button>
        <Button variant="outline" className="h-9 text-xs" disabled>
          <Phone className="mr-1.5 h-3.5 w-3.5" /> Enviar por WhatsApp
        </Button>
        <Button className="btn-gradient h-9 text-xs" onClick={onGoKickoff}>
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ir para Kickoff
        </Button>
        <Button variant="ghost" className="h-9 text-xs" onClick={onGoList}>
          Ver todos os contratos
        </Button>
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Cliente, projeto, cronograma, financeiro e tarefas serão criados automaticamente nas
        próximas evoluções do módulo.
      </p>
    </div>
  );
}