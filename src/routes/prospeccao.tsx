import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import { AppShell } from "@/components/AppShell";
import { RequireAuth, useRequiredUser } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarPlus,
  CheckCircle2,
  Download,
  Filter,
  Instagram,
  KanbanSquare,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Table as TableIcon,
  Target,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  POTENTIAL_LABEL,
  POTENTIAL_TONE,
  SEGMENTS,
  SOURCES,
  STATUS_LABEL,
  STATUS_TONE,
  UFS,
  type Interaction,
  type InteractionKind,
  type Prospect,
  type ProspectPotential,
  type ProspectStatus,
} from "@/lib/mock-prospects";
import {
  loadAllProspects,
  insertProspect,
  updateProspect,
  deleteProspects,
  addInteractionRemote,
  addInteractionsBatch,
  bulkUpdateProspects,
  applyImport,
  logImport,
  listImports,
  EXPECTED_HEADERS,
  type PreviewRow,
  type ImportLog,
} from "@/lib/prospects-api";
import { History, FileSpreadsheet } from "lucide-react";
import { EnrichmentDrawer } from "@/components/EnrichmentDrawer";
import { runEnrichment } from "@/lib/enrichment/api";
import { Loader2 } from "lucide-react";
import { Smartphone } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convertProspectToClient, crmKeys, invalidateCrmCore } from "@/lib/crm/api";
import { TouchpointModal } from "@/components/cadence/TouchpointModal";
import { ProspectTimeline } from "@/components/cadence/ProspectTimeline";
import { CloseCadenceDialog } from "@/components/cadence/CloseCadenceDialog";
import {
  addTouchpoint,
  cadenceKeys,
  proximaAcaoLabel,
  type TouchpointTipo,
} from "@/lib/cadence/api";
import { wasDispatchedToday, dispatchBlockedMessage } from "@/lib/dispatch-lock";


export const Route = createFileRoute("/prospeccao")({
  head: () => ({ meta: [{ title: "Prospecção — INFINDA" }] }),
  errorComponent: ({ error }) => {
    console.error("/prospeccao route error", error);
    return (
      <AppShell title="Prospecção" subtitle="Sua máquina de geração de oportunidades comerciais">
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Erro ao carregar Prospecção: {error instanceof Error ? error.message : String(error)}
        </div>
      </AppShell>
    );
  },
  notFoundComponent: () => (
    <AppShell title="Prospecção" subtitle="Sua máquina de geração de oportunidades comerciais">
      <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
        Página de prospecção não encontrada.
      </div>
    </AppShell>
  ),
  component: () => (
    <RequireAuth>
      <ProspeccaoPage />
    </RequireAuth>
  ),
});

const STATUSES: ProspectStatus[] = [
  "nao_contatado",
  "primeiro_contato",
  "em_negociacao",
  "qualificado",
  "agendado",
  "perdido",
  "briefing_enviado",
  "diagnostico_pendente",
  "proposta_pendente",
  "proposta_enviada",
  "fechado_ganho",
  "aguardando_kickoff",
  "aguardando_producao",
  "em_producao",
  "entregue",
];
const POTENTIALS: ProspectPotential[] = ["alto", "medio", "baixo"];
const STATUS_SET = new Set<ProspectStatus>([...STATUSES, "cliente"]);
const POTENTIAL_SET = new Set<ProspectPotential>(POTENTIALS);

// safeProspect foi removido — `fromRow` em prospects-api.ts já garante o shape
// e defaults. Mantemos os Sets exportados para uso por validações pontuais.

const onlyDigits = (s: string) => s.replace(/\D/g, "");

function formatBrPhone(raw: string): string {
  const d = onlyDigits(raw);
  if (!d) return "";
  // remove leading country code 55 if 12-13 digits
  const n = d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  if (n.length === 9) return `${n.slice(0, 5)}-${n.slice(5)}`;
  if (n.length === 8) return `${n.slice(0, 4)}-${n.slice(4)}`;
  return raw.trim();
}
function isMobile(raw: string): boolean {
  const d = onlyDigits(raw);
  const n = d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
  // 11 dígitos novo padrão (DDD + 9XXXXXXXX) ou 10 dígitos legado (DDD + 9XXXXXXX)
  return (n.length === 11 && n[2] === "9") || (n.length === 10 && n[2] === "9");
}
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s|[\/\-])([a-zà-ú])/g, (_, p, c) => p + c.toUpperCase());
}

// "DENISE NUNES ***918940**; Sócio-Administrador" -> "Denise Nunes"
// Também trata múltiplos sócios separados por ";" pegando apenas o primeiro.
function cleanQuadroSocietario(raw: string): string {
  if (!raw) return "";
  const first = raw.split(/(?<=\*\*)\s*;|\n/)[0] || raw;
  const name = first
    .replace(/\*{2,}\d+\*{2,}/g, "")  // máscara de CPF ***918940**
    .replace(/;.*$/, "")               // remove cargo após ;
    .replace(/\s{2,}/g, " ")
    .trim();
  return name ? toTitleCase(name) : "";
}

const UF_NAME_TO_CODE: Record<string, string> = {
  acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA",
  ceara: "CE", "distrito federal": "DF", df: "DF", "espirito santo": "ES",
  goias: "GO", maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
  "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR", pernambuco: "PE",
  piaui: "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
  "rio grande do sul": "RS", rondonia: "RO", roraima: "RR", "santa catarina": "SC",
  "sao paulo": "SP", sergipe: "SE", tocantins: "TO",
};
const VALID_UFS = new Set([
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
]);
function normalizeUf(raw: string): string {
  const v = raw.trim().toUpperCase();
  if (!v) return "";
  if (v.length === 2 && VALID_UFS.has(v)) return v;
  const key = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return UF_NAME_TO_CODE[key] ?? (VALID_UFS.has(v.slice(0, 2)) ? v.slice(0, 2) : "");
}
function parseLocation(cityRaw: string, stateRaw: string): { city: string; state: string } {
  let state = normalizeUf(stateRaw);
  let city = cityRaw;
  // tenta extrair UF embutida em "Joinville/SC", "Joinville - SC", "SC - Joinville", "Joinville (SC)"
  if (!state) {
    const m = city.match(/\b([A-Za-zÀ-ú]{2,})\s*[\/\-–|()]+\s*([A-Za-z]{2,})\b/);
    if (m) {
      const a = normalizeUf(m[1]); const b = normalizeUf(m[2]);
      if (a && !b) { state = a; city = m[2]; }
      else if (b && !a) { state = b; city = m[1]; }
    }
  }
  city = city.replace(/[\/\-–|()]+\s*[A-Za-z]{2}\s*$/, "").replace(/^\s*[A-Za-z]{2}\s*[\/\-–|()]+/, "").trim();
  return { city, state };
}


const INTERACTION_ICON: Record<InteractionKind, typeof MessageSquare> = {
  whatsapp: MessageSquare,
  ligacao: Phone,
  email: Mail,
  reuniao: CalendarPlus,
  nota: StickyNote,
  status: CheckCircle2,
};
const INTERACTION_LABEL: Record<InteractionKind, string> = {
  whatsapp: "WhatsApp",
  ligacao: "Ligação",
  email: "Email",
  reuniao: "Reunião",
  nota: "Nota",
  status: "Status",
};

function StatCard({
  icon: Icon, label, value, hint,
}: { icon: typeof Users; label: string; value: number; hint: string }) {
  return (
    <div className="surface-card p-4">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent">
        <Icon className="h-4 w-4 text-primary-glow" />
      </span>
      <p className="mt-4 text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value.toLocaleString("pt-BR")}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[status] ?? STATUS_TONE.nao_contatado}`}>
      {STATUS_LABEL[status] ?? STATUS_LABEL.nao_contatado}
    </span>
  );
}
function PotentialBadge({ p }: { p: ProspectPotential }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${POTENTIAL_TONE[p] ?? POTENTIAL_TONE.medio}`}>
      {POTENTIAL_LABEL[p] ?? POTENTIAL_LABEL.medio}
    </span>
  );
}

function NativeCheckbox({
  checked,
  onChange,
  ariaLabel,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
      aria-label={ariaLabel}
      className={`h-4 w-4 shrink-0 cursor-pointer rounded-sm border border-primary bg-transparent accent-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

const EMPTY_FORM: Omit<Prospect, "id" | "createdAt"> = {
  company: "", segment: SEGMENTS[0], owner: "",
  whatsapp: "", phone: "", email: "", instagram: "",
  city: "", state: "SP", source: SOURCES[0],
  potential: "medio", status: "nao_contatado",
};

const newId = (prefix = "p") => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// Formatação só na UI — dados em ISO no estado/cache.
function fmtBR(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function ProspeccaoPage() {
  const user = useRequiredUser();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | "all">("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [potentialFilter, setPotentialFilter] = useState<ProspectPotential | "all">("all");
  const [onlyWithContact, setOnlyWithContact] = useState(false);
  const [noWhatsapp, setNoWhatsapp] = useState(false);
  const [onlyWhatsapp, setOnlyWhatsapp] = useState(false);
  type CadenceChip = "all" | "hoje" | "atrasados" | "sem_resposta" | "responderam" | "interessados" | "clientes";
  const [cadenceFilter, setCadenceFilter] = useState<CadenceChip>("all");
  const [touchpointTarget, setTouchpointTarget] = useState<{ prospect: Prospect; tipo: TouchpointTipo } | null>(null);
  const [closeCadenceTarget, setCloseCadenceTarget] = useState<Prospect | null>(null);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"table" | "kanban">("table");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, owner: user.name });
  const [detailId, setDetailId] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewFileName, setPreviewFileName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [enrichFor, setEnrichFor] = useState<Prospect | null>(null);
  const [whatsConfirm, setWhatsConfirm] = useState<{ id: string; company: string } | null>(null);
  type WaAccount = "default" | "personal" | "business";
  const [waAccount, setWaAccount] = useState<WaAccount>("default");
  const [quickEnrichingIds, setQuickEnrichingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("wa_account") as WaAccount | null;
    if (saved === "default" || saved === "personal" || saved === "business") setWaAccount(saved);
  }, []);
  const changeWaAccount = (v: WaAccount) => {
    setWaAccount(v);
    try { window.localStorage.setItem("wa_account", v); } catch { /* ignore */ }
    toast.success(
      v === "business" ? "Disparos via WhatsApp Business" :
      v === "personal" ? "Disparos via WhatsApp Normal" :
      "Disparos via app padrão do sistema",
    );
  };

  // Única fonte de verdade. Mutations fazem optimistic update via setCache
  // diretamente no cache do Query — sem espelho via useState/useEffect.
  const prospectsQ = useQuery({
    queryKey: crmKeys.prospects,
    queryFn: loadAllProspects,
    enabled: !!user,
    staleTime: 5_000,
  });
  const prospects = useMemo(
    () => (Array.isArray(prospectsQ.data) ? prospectsQ.data : []) as Prospect[],
    [prospectsQ.data],
  );
  const loading = prospectsQ.isLoading;
  useEffect(() => {
    if (prospectsQ.error) toast.error(`Falha ao carregar: ${(prospectsQ.error as Error).message}`);
  }, [prospectsQ.error]);

  // Helper para optimistic updates no cache do Query.
  const setCache = (update: (prev: Prospect[]) => Prospect[]) =>
    qc.setQueryData<Prospect[]>(crmKeys.prospects, (old) => update(Array.isArray(old) ? (old as Prospect[]) : []));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setDialogOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prospects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (segmentFilter !== "all" && (p.segment || "").trim().toLowerCase() !== segmentFilter.toLowerCase()) return false;
      if (stateFilter !== "all" && p.state !== stateFilter) return false;
      if (potentialFilter !== "all" && p.potential !== potentialFilter) return false;
      if (onlyWithContact) {
        const hasContact = Boolean(
          (p.whatsapp && p.whatsapp.trim()) ||
          (p.phone && p.phone.trim()) ||
          (p.email && p.email.trim()),
        );
        if (!hasContact) return false;
      }
      if (noWhatsapp) {
        const digits = (p.whatsapp || "").replace(/\D/g, "");
        if (digits.length >= 10) return false;
      }
      if (onlyWhatsapp) {
        const digits = (p.whatsapp || "").replace(/\D/g, "");
        if (digits.length < 10) return false;
      }
      // Filtros de cadência (Fase 6) — só ativos quando migration aplicada e dados populados.
      if (cadenceFilter !== "all") {
        const now = Date.now();
        const nx = p.nextContactAt ? new Date(p.nextContactAt).getTime() : null;
        const today = new Date(); today.setHours(0,0,0,0);
        const tomorrow = today.getTime() + 86400000;
        switch (cadenceFilter) {
          case "hoje":
            if (!(p.cadenceStatus === "ativo" && nx !== null && nx >= today.getTime() && nx < tomorrow)) return false;
            break;
          case "atrasados":
            if (!(p.cadenceStatus === "ativo" && nx !== null && nx < now)) return false;
            break;
          case "sem_resposta":
            if (!(p.responseStatus === "sem_resposta" && p.lastContactAt)) return false;
            break;
          case "responderam":
            if (!(p.responseStatus && ["respondeu","interessado","cliente"].includes(p.responseStatus))) return false;
            break;
          case "interessados":
            if (p.responseStatus !== "interessado") return false;
            break;
          case "clientes":
            if (p.responseStatus !== "cliente") return false;
            break;
        }
      }
      if (!q) return true;
      return [p.company, p.segment, p.owner, p.email, p.whatsapp, p.phone, p.instagram, p.city, p.state, p.source]
        .join(" ").toLowerCase().includes(q);
    });
  }, [prospects, search, statusFilter, segmentFilter, stateFilter, potentialFilter, onlyWithContact, noWhatsapp, onlyWhatsapp, cadenceFilter]);

  // Bloqueio de 24h por disparo recente (whatsapp/ligação/email outbound).
  // Empresas com disparo nas últimas 24h são jogadas para o FINAL da lista,
  // ordenadas pelo disparo mais antigo primeiro (próximas a "destravar").
  const filteredOrdered = useMemo(() => {
    const BLOCK_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const isOutbound = (k: string) => k === "whatsapp" || k === "ligacao" || k === "email";
    const lastOut = (p: Prospect): number => {
      let max = 0;
      for (const ix of p.interactions ?? []) {
        if (!isOutbound(ix.kind)) continue;
        const t = ix.at ? Date.parse(ix.at) : 0;
        if (t > max) max = t;
      }
      return max;
    };
    const active: Prospect[] = [];
    const blocked: Array<{ p: Prospect; last: number }> = [];
    for (const p of filtered) {
      const last = lastOut(p);
      if (last > 0 && now - last < BLOCK_MS) blocked.push({ p, last });
      else active.push(p);
    }
    blocked.sort((a, b) => a.last - b.last);
    return [...active, ...blocked.map((b) => b.p)];
  }, [filtered]);

  const availableSegments = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prospects) {
      const s = (p.segment || "").trim();
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  }, [prospects]);

  // Apenas UFs reais presentes na base (derivadas do CNPJ/cadastro).
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      const uf = normalizeUf(p.state || "");
      if (uf) set.add(uf);
    }
    return Array.from(set).sort();
  }, [prospects]);

  // Responsáveis derivados dinamicamente de prospects.owner_name + nome do
   // usuário logado (fallback). Antes era hardcoded ["Valdinei","Danielly"].
  const availableOwners = useMemo(() => {
    const set = new Set<string>();
    for (const p of prospects) {
      const o = (p.owner || "").trim();
      if (o) set.add(o);
    }
    if (user?.name) set.add(user.name);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [prospects, user?.name]);

  const stats = useMemo(() => {
    const t = prospects.length;
    // "Contatadas" = base com pelo menos 1 touchpoint outbound (whatsapp/ligação/email).
    // Mesma definição usada pelo Dashboard de Cadência (prospect_touchpoints),
    // evitando divergência entre os módulos.
    const isOutbound = (k: string) => k === "whatsapp" || k === "ligacao" || k === "email";
    const contatadas = prospects.filter(
      (p) => (p.interactions ?? []).some((ix) => isOutbound(ix.kind)),
    ).length;
    const qualificadas = prospects.filter((p) => p.status === "qualificado").length;
    const agendadas = prospects.filter((p) => p.status === "agendado").length;
    let disparos = 0;
    for (const p of prospects) {
      for (const ix of p.interactions ?? []) {
        if (isOutbound(ix.kind)) disparos++;
      }
    }
    return { t, contatadas, qualificadas, agendadas, disparos };
  }, [prospects]);

  const detail = useMemo(
    () => prospects.find((p) => p.id === detailId) ?? null,
    [prospects, detailId],
  );

  const addInteraction = (id: string, kind: InteractionKind, text: string) => {
    const tempIx: Interaction = {
      id: newId("ix"), kind, text, by: user.name, at: new Date().toISOString(),
    };
    setCache((prev) =>
      prev.map((p) => (p.id === id ? { ...p, interactions: [tempIx, ...(p.interactions ?? [])] } : p)),
    );
    addInteractionRemote(id, kind, text, user.name).then((saved) => {
      if (!saved) return;
      setCache((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, interactions: [saved, ...(p.interactions ?? []).filter((i) => i.id !== tempIx.id)] }
            : p,
        ),
      );
    });
  };

  const updateStatus = (id: string, status: ProspectStatus) => {
    console.log("[prosp] updateStatus:start", { id, status });
    setCache((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    updateProspect(id, { status })
      .then(() => {
        console.log("[prosp] updateStatus:ok", { id, status });
        return invalidateCrmCore(qc);
      })
      .catch((e) => {
        console.error("[prosp] updateStatus:error", { id, status, error: e });
        toast.error(`Erro: ${e.message ?? e}`);
      });
    addInteraction(id, "status", `Status alterado para "${STATUS_LABEL[status]}"`);
    toast.success(`Status: ${STATUS_LABEL[status]}`);
  };

  const removeProspect = (ids: string[]) => {
    setCache((prev) => prev.filter((p) => !ids.includes(p.id)));
    setSelected(new Set());
    deleteProspects(ids)
      .then(() => { toast.success(`${ids.length} empresa(s) removida(s)`); return invalidateCrmCore(qc); })
      .catch((e) => toast.error(`Erro: ${e.message ?? e}`));
  };

  const bulkStatus = async (status: ProspectStatus) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    // Optimistic + interações em memória
    const text = `Status em lote → "${STATUS_LABEL[status]}"`;
    const temps: Record<string, Interaction> = {};
    for (const id of ids) {
      temps[id] = { id: newId("ix"), kind: "status", text, by: user.name, at: new Date().toISOString() };
    }
    setCache((prev) =>
      prev.map((p) =>
        ids.includes(p.id)
          ? { ...p, status, interactions: [temps[p.id], ...(p.interactions ?? [])] }
          : p,
      ),
    );
    setSelected(new Set());
    try {
      await bulkUpdateProspects(ids, { status });
      const saved = await addInteractionsBatch(
        ids.map((id) => ({ prospectId: id, kind: "status" as InteractionKind, text, byName: user.name })),
      );
      setCache((prev) =>
        prev.map((p) => {
          const s = saved.find((x) => x.prospectId === p.id)?.ix;
          if (!s) return p;
          return {
            ...p,
            interactions: [s, ...(p.interactions ?? []).filter((i) => i.id !== temps[p.id]?.id)],
          };
        }),
      );
      await invalidateCrmCore(qc);
      toast.success(`${ids.length} atualizada(s) para ${STATUS_LABEL[status]}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    }
  };

  const bulkAssign = async (owner: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setCache((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, owner } : p)));
    setSelected(new Set());
    try {
      await bulkUpdateProspects(ids, { owner });
      await invalidateCrmCore(qc);
      toast.success(`${ids.length} atribuída(s) a ${owner}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allVisibleSelected = filteredOrdered.length > 0 && filteredOrdered.every((p) => selected.has(p.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) setSelected(new Set());
    else setSelected(new Set(filteredOrdered.map((p) => p.id)));
  };

  const logAttempt = async (prospect: Prospect, tipo: TouchpointTipo) => {
    try {
      console.log("[prosp] logAttempt:start", { prospectId: prospect.id, tipo });
      await addTouchpoint({
        prospect_id: prospect.id,
        tipo,
        resultado: "enviado",
        mensagem: "auto: clique na ação",
      });
      console.log("[prosp] logAttempt:ok", { prospectId: prospect.id, tipo });
      // Fonte única: addTouchpoint já gravou em prospect_touchpoints, que agora
      // alimenta também o contador "Conversas iniciadas" e a timeline do card.
      qc.invalidateQueries({ queryKey: cadenceKeys.dashboard });
      qc.invalidateQueries({ queryKey: cadenceKeys.timeline(prospect.id) });
    } catch (e) {
      console.error("[prosp] logAttempt:error", { prospectId: prospect.id, tipo, error: e });
      /* não bloqueia o deep link */
    }
  };

  const openWhats = async (p: Prospect) => {
    console.log("[prosp] openWhats:click", { id: p.id, company: p.company, whatsapp: p.whatsapp });
    const d = onlyDigits(p.whatsapp);
    if (!d) {
      console.warn("[prosp] openWhats:abort:no-whatsapp", { id: p.id });
      return toast.error("WhatsApp não cadastrado");
    }
    const lock = await wasDispatchedToday({ prospectId: p.id });
    if (lock.blocked) {
      console.warn("[prosp] openWhats:blocked", { id: p.id, source: lock.source });
      return toast.error(dispatchBlockedMessage(lock.source!));
    }
    // Rotação anti-bloqueio: 3 variantes diferentes da abordagem inicial.
    // O WhatsApp pune padrões repetidos em massa, então revezamos a cada
    // disparo via contador persistido em localStorage.
    const variants: string[] = [
      `Olá, vi que sua empresa foi aberta recentemente. Parabéns pela nova fase! 🎉\nPercebi que muitas empresas novas acabam perdendo oportunidades por ainda não terem uma presença profissional na internet.\n\nEu ajudo negócios a terem um site moderno que transmite confiança e gera contatos desde os primeiros meses de operação.\n\nPosso te mostrar alguns exemplos e fazer uma análise gratuita da sua presença digital?`,
      `Oi! Tudo bem? Aqui é da INFINDA Digital 👋\nDei uma olhada no seu negócio e percebi que dá pra aumentar bastante a visibilidade online com algumas mudanças simples — site profissional, Google Meu Negócio e captação de contatos.\n\nMontei um diagnóstico rápido e gratuito da presença digital da sua empresa. Posso te mandar por aqui mesmo?`,
      `Olá! 🙌 Estou ajudando empresas da sua região a aparecerem mais no Google e a converter mais clientes pela internet.\n\nNotei alguns pontos no seu negócio que podem render bons resultados em pouco tempo (site, redes e tráfego). Te interessa receber uma análise gratuita com sugestões práticas, sem compromisso?`,
    ];
    const rotKey = "msg_rot:prospeccao:whatsapp";
    let rotIdx = 0;
    try {
      const cur = Number(window.localStorage.getItem(rotKey) || "0") || 0;
      rotIdx = cur % variants.length;
      window.localStorage.setItem(rotKey, String((cur + 1) % variants.length));
    } catch { /* ignore */ }
    const msg = variants[rotIdx];
    // Define o confirm ANTES de abrir o WhatsApp para garantir que o estado
    // esteja commitado caso o navegador móvel saia da aba para o app.
    console.log("[prosp] openWhats:setConfirm", { id: p.id, company: p.company });
    setWhatsConfirm({ id: p.id, company: p.company });
    void logAttempt(p, "whatsapp");
    // Honra a conta de WhatsApp escolhida (Normal/Business). No Android
    // forçamos o app correto via intent://; no iPhone/desktop o link abre
    // o app definido como padrão do sistema.
    const phone = `55${d}`;
    const encoded = encodeURIComponent(msg);
    const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
    let url = `https://wa.me/${phone}?text=${encoded}`;
    if (isAndroid && waAccount !== "default") {
      const pkg = waAccount === "business" ? "com.whatsapp.w4b" : "com.whatsapp";
      url = `intent://send?phone=${phone}&text=${encoded}#Intent;scheme=whatsapp;package=${pkg};end`;
    }
    console.log("[prosp] openWhats:window.open", { url, account: waAccount });
    window.open(url, "_blank");
  };

  // Enriquecimento "suspenso" — roda direto na linha sem abrir o Sheet/Drawer.
  // Usa o mesmo fluxo do bulkEnrich (CNPJ → Receita/CNPJá/etc) e aplica patch
  // otimista no cache, mostrando spinner via toast.
  const quickEnrich = async (p: Prospect) => {
    const cnpj = (p.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14) {
      // Sem CNPJ válido, cai no drawer manual para o usuário ajustar.
      setEnrichFor(p);
      return;
    }
    if (quickEnrichingIds.has(p.id)) return;
    setQuickEnrichingIds((prev) => { const n = new Set(prev); n.add(p.id); return n; });
    const tid = toast.loading(`Enriquecendo ${p.company}…`);
    try {
      const r = await runEnrichment(p.cnpj!, { prospectId: p.id });
      const patch: Partial<Prospect> = {};
      const tel = r.profile.telefone_1 ?? r.profile.telefone_2;
      if (!p.whatsapp && tel) patch.whatsapp = tel;
      if (!p.phone && r.profile.telefone_2 && r.profile.telefone_2 !== patch.whatsapp) patch.phone = r.profile.telefone_2;
      if (!p.email && r.profile.email) patch.email = r.profile.email;
      if (!p.city && r.address?.cidade) patch.city = r.address.cidade;
      if (!p.state && r.address?.uf) patch.state = r.address.uf;
      if (Object.keys(patch).length) {
        await updateProspect(p.id, patch);
        setCache((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
        toast.success(`${p.company}: ${Object.keys(patch).join(", ")} atualizado(s).`, { id: tid });
      } else {
        toast.message(`${p.company}: nada novo na Receita.`, { id: tid, description: "Toque novamente para ver os dados completos.", duration: 4000 });
      }
      void invalidateCrmCore(qc);
    } catch (e) {
      toast.error(`Falha ao enriquecer: ${(e as Error).message}`, { id: tid });
    } finally {
      setQuickEnrichingIds((prev) => { const n = new Set(prev); n.delete(p.id); return n; });
    }
  };
  const callPhone = async (p: Prospect) => {
    const d = onlyDigits(p.phone || p.whatsapp);
    if (!d) return toast.error("Telefone não cadastrado");
    const lock = await wasDispatchedToday({ prospectId: p.id });
    if (lock.blocked) return toast.error(dispatchBlockedMessage(lock.source!));
    window.open(`tel:+55${d}`);
    void logAttempt(p, "ligacao");
    setTouchpointTarget({ prospect: p, tipo: "ligacao" });
  };
  const openEmail = async (p: Prospect) => {
    if (!p.email) return toast.error("Email não cadastrado");
    const lock = await wasDispatchedToday({ prospectId: p.id });
    if (lock.blocked) return toast.error(dispatchBlockedMessage(lock.source!));
    window.open(`mailto:${p.email}`);
    void logAttempt(p, "email");
    setTouchpointTarget({ prospect: p, tipo: "email" });
  };

  const convertToLead = async (p: Prospect) => {
    try {
      const res = await convertProspectToClient(p.id, { dealTitle: p.company });
      setCache((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "cliente" } : x)));
      addInteraction(
        p.id,
        "status",
        res.created ? "Convertida em cliente no CRM" : "Cliente já existia — vínculo reforçado",
      );
      // Cross-module sync: CRM, clientes, dashboard, prospects
      qc.invalidateQueries({ queryKey: crmKeys.deals });
      qc.invalidateQueries({ queryKey: crmKeys.clients });
      qc.invalidateQueries({ queryKey: crmKeys.prospects });
      toast.success(res.created ? `${p.company} convertida em cliente` : `${p.company} já era cliente — vínculo atualizado`);
      setTimeout(() => navigate({ to: "/crm" }), 500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro ao converter: ${msg}`);
    }
  };

  const handleCreate = async () => {
    if (!form.company.trim()) return toast.error("Informe o nome da empresa");
    try {
      const saved = await insertProspect({
        ...form,
        owner: form.owner || user.name,
      });
      setCache((prev) => [saved, ...prev]);
      toast.success("Empresa cadastrada");
      setForm({ ...EMPTY_FORM, owner: user.name });
      setDialogOpen(false);
      void invalidateCrmCore(qc);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    }
  };


  const exportCsv = (rows = prospects) => {
    const headers = ["Empresa","Segmento","Responsavel","WhatsApp","Telefone","Email","Instagram","Cidade","Estado","Origem","Potencial","Status"];
    const data = rows.map((p) => [p.company, p.segment, p.owner, p.whatsapp, p.phone, p.email, p.instagram, p.city, p.state, p.source, p.potential, STATUS_LABEL[p.status]]);
    const csv = [headers, ...data].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prospeccao-infinda-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} linha(s) exportada(s)`);
  };

  const handleImport = async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop() || "";
    let rows: string[][] = [];
    try {
      if (ext === "xlsx" || ext === "xls") {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
        rows = aoa.map((r) => r.map((c) => (c == null ? "" : String(c).trim())));
      } else {
        const text = await file.text();
        const parseLine = (l: string): string[] => {
          const out: string[] = []; let cur = "", inQ = false;
          for (let i = 0; i < l.length; i++) {
            const c = l[i];
            if (c === '"') { if (inQ && l[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
            else if ((c === "," || c === ";") && !inQ) { out.push(cur); cur = ""; } else cur += c;
          }
          out.push(cur); return out.map((s) => s.trim());
        };
        rows = text.split(/\r?\n/).filter((l) => l.trim().length > 0).map(parseLine);
      }
    } catch (err) {
      console.error(err);
      return toast.error("Falha ao ler o arquivo");
    }
    if (rows.length < 2) return toast.error("Planilha vazia");

    const headers = rows[0].map((h) =>
      h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
    );
    const idx = (...needles: string[]) =>
      headers.findIndex((h) => needles.some((n) => h.includes(n)));

    const iFantasia = idx("nome fantasia", "fantasia");
    const iRazao = idx("razao social", "razao");
    const iEmpresa = idx("empresa");
    const iCompany = iFantasia >= 0 ? iFantasia : iEmpresa >= 0 ? iEmpresa : iRazao;
    if (iCompany < 0) {
      return toast.error(
        `Cabeçalho não reconhecido. Esperado: ${EXPECTED_HEADERS.join(", ")}`,
        { duration: 8000 },
      );
    }

    const f = {
      cnpj: idx("cnpj"),
      segmento: idx("atividade principal - texto", "atividade principal", "segmento", "setor", "ramo", "atividade"),
      responsavel: idx("respons", "consultor", "owner", "quadro societ"),
      whatsapp: idx("whatsapp", "whats", "celular"),
      telefone: idx("telefone", "fone", "fixo"),
      email: idx("email", "e-mail"),
      instagram: idx("instagram", "insta"),
      cidade: idx("municipio", "cidade"),
      estado: idx("uf", "estado"),
      origem: idx("origem", "fonte"),
      potencial: idx("potencial", "score", "porte"),
    };

    const previews: PreviewRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const c = rows[i];
      const fantasia = iFantasia >= 0 ? c[iFantasia] : "";
      const razao = iRazao >= 0 ? c[iRazao] : "";
      const rawCompany = (fantasia || razao || c[iCompany] || "").trim();
      const errors: string[] = [];

      const telRaw = f.telefone >= 0 ? c[f.telefone] || "" : "";
      const waRaw = f.whatsapp >= 0 ? c[f.whatsapp] || "" : "";
      let whatsapp = formatBrPhone(waRaw);
      let phone = formatBrPhone(telRaw);
      if (!whatsapp && telRaw && isMobile(telRaw)) { whatsapp = phone; phone = ""; }

      const cidadeRaw = f.cidade >= 0 ? (c[f.cidade] || "").trim() : "";
      const estadoRaw = f.estado >= 0 ? (c[f.estado] || "").trim() : "";
      const { city, state } = parseLocation(cidadeRaw, estadoRaw);

      const segRaw = f.segmento >= 0 ? (c[f.segmento] || "").trim() : "";
      const pot = (f.potencial >= 0 ? (c[f.potencial] || "").toLowerCase() : "") as ProspectPotential;
      const cnpjRaw = f.cnpj >= 0 ? onlyDigits(c[f.cnpj] || "") : "";

      if (!rawCompany) errors.push("Empresa vazia");

      previews.push({
        rowIndex: i + 1,
        errors,
        data: {
          company: rawCompany ? toTitleCase(rawCompany) : "",
          cnpj: cnpjRaw || undefined,
          segment: segRaw ? segRaw.charAt(0).toUpperCase() + segRaw.slice(1).toLowerCase() : "Outros",
          owner: f.responsavel >= 0 ? cleanQuadroSocietario(c[f.responsavel] || "") : "",
          whatsapp,
          phone,
          email: f.email >= 0 ? c[f.email] || "" : "",
          instagram: f.instagram >= 0 ? c[f.instagram] || "" : "",
          city: city ? toTitleCase(city) : "",
          state,
          source: (f.origem >= 0 ? c[f.origem] : "") || "Importação",
          potential: POTENTIALS.includes(pot) ? pot : "medio",
          status: "nao_contatado",
        },
      });
    }

    // mark duplicates by CNPJ
    const byCnpj = new Map<string, Prospect>();
    for (const p of prospects) if (p.cnpj) byCnpj.set(p.cnpj, p);
    for (const r of previews) {
      if (r.data.cnpj) {
        const m = byCnpj.get(r.data.cnpj);
        if (m) r.matchId = m.id;
      }
    }

    if (!previews.length) return toast.error("Nenhuma linha válida");
    setPreviewRows(previews);
    setPreviewFileName(file.name);
    setPreviewOpen(true);
  };

  const confirmImport = async () => {
    try {
      const result = await applyImport(previewRows, prospects);
      await logImport({
        fileName: previewFileName,
        performedBy: user.name,
        totalRows: previewRows.length,
        result,
      });
      setPreviewOpen(false);
      setPreviewRows([]);
      // invalidação dispara o refetch — não precisa de loadAllProspects manual
      await invalidateCrmCore(qc);
      toast.success(
        `Importação salva no banco: ${result.inserted} novas, ${result.updated} atualizadas, ${result.skipped} ignoradas`,
        { duration: 8000 },
      );
      if (result.errors.length) toast.error(`${result.errors.length} erro(s) registrados`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Erro: ${msg}`);
    }
  };


  const clearFilters = () => {
    setStatusFilter("all"); setSegmentFilter("all"); setStateFilter("all"); setPotentialFilter("all"); setSearch(""); setOnlyWithContact(false); setNoWhatsapp(false);
  };

  const bulkEnrich = async () => {
    const ids = Array.from(selected);
    const targets = prospects.filter((p) => ids.includes(p.id) && p.cnpj && p.cnpj.replace(/\D/g, "").length === 14);
    if (!targets.length) {
      toast.error("Selecione empresas com CNPJ válido (14 dígitos).");
      return;
    }
    setBulkEnriching(true);
    let ok = 0, fail = 0, contatosNovos = 0;
    const tid = toast.loading(`Enriquecendo 0/${targets.length}…`);
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      try {
        const r = await runEnrichment(p.cnpj!, { prospectId: p.id });
        const patch: Partial<Prospect> = {};
        const tel = r.profile.telefone_1 ?? r.profile.telefone_2;
        if (!p.whatsapp && tel) patch.whatsapp = tel;
        if (!p.phone && r.profile.telefone_2 && r.profile.telefone_2 !== patch.whatsapp) patch.phone = r.profile.telefone_2;
        if (!p.email && r.profile.email) patch.email = r.profile.email;
        if (!p.city && r.address?.cidade) patch.city = r.address.cidade;
        if (!p.state && r.address?.uf) patch.state = r.address.uf;
        if (Object.keys(patch).length) {
          await updateProspect(p.id, patch);
          contatosNovos++;
          setCache((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
        }
        ok++;
      } catch {
        fail++;
      }
      toast.loading(`Enriquecendo ${i + 1}/${targets.length}…`, { id: tid });
      // pequena pausa para respeitar limites das APIs públicas (BrasilAPI / Nominatim)
      await new Promise((res) => setTimeout(res, 800));
    }
    toast.success(
      `Enriquecimento concluído: ${ok} ok, ${fail} falhas, ${contatosNovos} contato(s) preenchido(s).`,
      { id: tid, duration: 8000 },
    );
    void invalidateCrmCore(qc);
    setBulkEnriching(false);
  };

  const bulkFillWhatsapp = async () => {
    const ids = Array.from(selected);
    const missingWa = prospects.filter((p) => {
      if (!ids.includes(p.id)) return false;
      const digits = (p.whatsapp || "").replace(/\D/g, "");
      return digits.length < 10;
    });
    const targets = missingWa.filter((p) => p.cnpj && p.cnpj.replace(/\D/g, "").length === 14);
    const semCnpj = missingWa.length - targets.length;
    if (!targets.length) {
      toast.error(
        missingWa.length === 0
          ? "Nenhuma das selecionadas está sem WhatsApp."
          : "As selecionadas sem WhatsApp não possuem CNPJ válido para enriquecimento.",
      );
      return;
    }
    setBulkEnriching(true);
    let ok = 0, fail = 0, preenchidos = 0;
    const tid = toast.loading(`Preenchendo WhatsApp 0/${targets.length}…`);
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i];
      try {
        const r = await runEnrichment(p.cnpj!, { prospectId: p.id });
        const tel = r.profile.telefone_1 ?? r.profile.telefone_2;
        if (tel) {
          const patch: Partial<Prospect> = { whatsapp: tel };
          if (!p.phone && r.profile.telefone_2 && r.profile.telefone_2 !== tel) patch.phone = r.profile.telefone_2;
          await updateProspect(p.id, patch);
          setCache((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
          preenchidos++;
        }
        ok++;
      } catch {
        fail++;
      }
      toast.loading(`Preenchendo WhatsApp ${i + 1}/${targets.length}…`, { id: tid });
      await new Promise((res) => setTimeout(res, 800));
    }
    toast.success(
      `WhatsApp preenchido em ${preenchidos}/${targets.length}. ${fail} falha(s)${semCnpj ? `, ${semCnpj} sem CNPJ ignorada(s)` : ""}.`,
      { id: tid, duration: 8000 },
    );
    void invalidateCrmCore(qc);
    setBulkEnriching(false);
  };

  const selCount = selected.size;

  // Render guard: nunca tentar renderizar listas antes do cache estar pronto.
  if (prospectsQ.isLoading && !prospectsQ.data) {
    return (
      <AppShell title="Prospecção" subtitle="Sua máquina de geração de oportunidades comerciais">
        <div className="grid place-items-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mb-2 h-5 w-5 animate-spin" />
          Carregando empresas…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Prospecção"
      subtitle="Sua máquina de geração de oportunidades comerciais"
      actions={
        <div className="hidden items-center gap-2 sm:flex">
          <Button variant="outline" className="h-9 text-xs" onClick={() => exportCsv()}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button variant="outline" className="h-9 text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" className="h-9 text-xs" onClick={() => setHistoryOpen(true)}>
            <History className="mr-1.5 h-4 w-4" /> Histórico
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 text-xs"
                title="Conta de WhatsApp usada nos disparos"
              >
                <Smartphone className="mr-1.5 h-4 w-4" />
                {waAccount === "business" ? "WA Business" : waAccount === "personal" ? "WA Normal" : "WA Padrão"}
                <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                Conta de WhatsApp para disparos
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => changeWaAccount("default")}>
                <Check className={cn("mr-2 h-4 w-4", waAccount === "default" ? "opacity-100" : "opacity-0")} />
                Padrão do sistema
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeWaAccount("personal")}>
                <Check className={cn("mr-2 h-4 w-4", waAccount === "personal" ? "opacity-100" : "opacity-0")} />
                WhatsApp Normal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeWaAccount("business")}>
                <Check className={cn("mr-2 h-4 w-4", waAccount === "business" ? "opacity-100" : "opacity-0")} />
                WhatsApp Business
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
                A escolha entre Normal e Business só é forçada no Android (via intent).
                No iPhone/desktop abre o app definido como padrão do sistema.
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient h-9 text-xs font-semibold">
                <Plus className="mr-1.5 h-4 w-4" /> Nova empresa
              </Button>
            </DialogTrigger>
            <NewProspectDialog form={form} setForm={setForm} onCreate={handleCreate} />
          </Dialog>

        </div>
      }
    >
      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Building2} label="Empresas cadastradas" value={stats.t} hint="Base total" />
        <StatCard icon={MessageSquare} label="Contatadas" value={stats.contatadas} hint="Pelo menos 1 contato" />
        <StatCard icon={MessageSquare} label="Conversas iniciadas" value={stats.disparos} hint="WhatsApp · ligação · e-mail" />
        <StatCard icon={Target} label="Qualificadas" value={stats.qualificadas} hint="Prontas para proposta" />
        <StatCard icon={CalendarPlus} label="Agendadas" value={stats.agendadas} hint="Com reunião marcada" />
      </section>

      {/* Cadência — chips de filtro server-side-shape e widget de ações de hoje */}
      <section className="mt-6 surface-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { k: "all",          label: "Todos" },
            { k: "hoje",         label: "🔥 Hoje" },
            { k: "atrasados",    label: "⚠️ Atrasados" },
            { k: "sem_resposta", label: "📩 Sem resposta" },
            { k: "responderam",  label: "💬 Responderam" },
            { k: "interessados", label: "🎯 Interessados" },
            { k: "clientes",     label: "✅ Clientes" },
          ] as { k: typeof cadenceFilter; label: string }[]).map((c) => (
            <button
              key={c.k}
              onClick={() => setCadenceFilter(c.k)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                cadenceFilter === c.k
                  ? "border-primary bg-primary/15 text-primary-glow"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Toolbar */}
      <section className="mt-6 surface-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca inteligente: empresa, contato, cidade, segmento…"
              className="h-10 pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as "table" | "kanban")}>
              <TabsList className="h-10">
                <TabsTrigger value="table" className="text-xs"><TableIcon className="mr-1.5 h-3.5 w-3.5" />Tabela</TabsTrigger>
                <TabsTrigger value="kanban" className="text-xs"><KanbanSquare className="mr-1.5 h-3.5 w-3.5" />Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" className="h-10 text-xs" onClick={() => setShowFilters((s) => !s)}>
              <Filter className="mr-1.5 h-4 w-4" /> Filtros
              {(statusFilter !== "all" || segmentFilter !== "all" || stateFilter !== "all" || potentialFilter !== "all" || onlyWithContact) && (
                <span className="ml-2 rounded-full bg-primary/20 px-1.5 text-[10px] text-primary-glow">ativos</span>
              )}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProspectStatus | "all")}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="h-9 w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {segmentFilter === "all"
                      ? `Todos segmentos (${availableSegments.reduce((a, s) => a + s.count, 0)})`
                      : `${segmentFilter} (${availableSegments.find((s) => s.name === segmentFilter)?.count ?? 0})`}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar nicho…" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Nenhum nicho encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__all__"
                        onSelect={() => setSegmentFilter("all")}
                      >
                        <Check className={cn("mr-2 h-4 w-4", segmentFilter === "all" ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">Todos segmentos</span>
                        <span className="text-xs text-muted-foreground">
                          {availableSegments.reduce((a, s) => a + s.count, 0)}
                        </span>
                      </CommandItem>
                      {availableSegments.map((s) => (
                        <CommandItem
                          key={s.name}
                          value={s.name}
                          onSelect={() => setSegmentFilter(s.name)}
                        >
                          <Check className={cn("mr-2 h-4 w-4", segmentFilter === s.name ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{s.count}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos estados</SelectItem>
                {availableStates.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={potentialFilter} onValueChange={(v) => setPotentialFilter(v as ProspectPotential | "all")}>
              <SelectTrigger><SelectValue placeholder="Potencial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos potenciais</SelectItem>
                {POTENTIALS.map((p) => <SelectItem key={p} value={p}>{POTENTIAL_LABEL[p]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={clearFilters} className="h-10 text-xs">
              <X className="mr-1.5 h-4 w-4" /> Limpar filtros
            </Button>
            <label className="col-span-full flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
              <NativeCheckbox
                checked={onlyWithContact}
                onChange={setOnlyWithContact}
                ariaLabel="Mostrar somente empresas com contato disponível"
              />
              Mostrar somente empresas com contato disponível (WhatsApp, telefone ou e-mail)
            </label>
            <label className="col-span-full flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
              <NativeCheckbox
                checked={noWhatsapp}
                onChange={(v) => { setNoWhatsapp(v); if (v) setOnlyWhatsapp(false); }}
                ariaLabel="Mostrar somente empresas sem WhatsApp"
              />
              Somente <strong className="text-foreground">sem WhatsApp</strong> — útil para enriquecer a base (Google/Instagram/CNPJ)
            </label>
            <label className="col-span-full flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
              <NativeCheckbox
                checked={onlyWhatsapp}
                onChange={(v) => { setOnlyWhatsapp(v); if (v) setNoWhatsapp(false); }}
                ariaLabel="Mostrar somente empresas com WhatsApp cadastrado"
              />
              Somente <strong className="text-foreground">com WhatsApp cadastrado</strong> (número válido com ao menos 10 dígitos)
            </label>
          </div>
        )}
      </section>

      {/* Bulk action bar */}
      {selCount > 0 && (
        <section className="surface-card mt-3 flex flex-col items-start gap-3 border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-md bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary-glow">
              {selCount} selecionada{selCount > 1 ? "s" : ""}
            </span>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Alterar status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {STATUSES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => bulkStatus(s)} className="text-xs">
                    {STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Users className="mr-1.5 h-3.5 w-3.5" /> Atribuir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {availableOwners.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs">Nenhum responsável cadastrado</DropdownMenuItem>
                ) : (
                  availableOwners.map((n) => (
                    <DropdownMenuItem key={n} onClick={() => bulkAssign(n)} className="text-xs">{n}</DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => exportCsv(prospects.filter((p) => selected.has(p.id)))}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs border-primary/30 text-primary-glow hover:bg-primary/10"
              disabled={bulkEnriching}
              onClick={bulkEnrich}>
              {bulkEnriching
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Enriquecer em massa
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              disabled={bulkEnriching}
              onClick={bulkFillWhatsapp}
              title="Preenche o WhatsApp apenas das selecionadas marcadas como Sem WhatsApp (via CNPJ)">
              {bulkEnriching
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              Preencher WhatsApp
            </Button>
            <Button variant="outline" size="sm"
              className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
              onClick={() => removeProspect(Array.from(selected))}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        </section>
      )}

      {/* View */}
      {view === "table" ? (
        <section className="mt-4 surface-card overflow-hidden">
          {/* Mobile: card list */}
          <div className="md:hidden">
            <MobileProspectList
              items={filteredOrdered}
              selected={selected}
              onToggleSelect={toggleSelect}
              onOpen={setDetailId}
              onWhats={openWhats}
              onCall={callPhone}
              onAgendar={(id) => updateStatus(id, "agendado")}
              onConvert={convertToLead}
              onStatus={updateStatus}
              onRemove={(id) => removeProspect([id])}
              onEnrich={(p) => quickEnrich(p)}
              busyIds={quickEnrichingIds}
            />
          </div>
          <DesktopProspectTable
            items={filteredOrdered}
            selected={selected}
            allVisibleSelected={allVisibleSelected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpen={setDetailId}
            onWhats={openWhats}
            onCall={callPhone}
            onAgendar={(id) => updateStatus(id, "agendado")}
            onConvert={convertToLead}
            onStatus={updateStatus}
            onRemove={(id) => removeProspect([id])}
          />
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            <span>Mostrando {filteredOrdered.length} de {prospects.length} empresas · empresas com disparo nas últimas 24h vão para o final</span>
            <span className="hidden sm:inline">INFINDA digital — Prospecção</span>
          </div>
        </section>
      ) : (
        <KanbanView
          prospects={filteredOrdered}
          onOpen={(id) => setDetailId(id)}
          onMove={(id, status) => updateStatus(id, status)}
        />
      )}

      {/* Detail modal */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        {detail && (
          <DetailDialog
            p={detail}
            onWhats={() => openWhats(detail)}
            onCall={() => callPhone(detail)}
            onStatus={(s) => updateStatus(detail.id, s)}
            onConvert={() => convertToLead(detail)}
            onAddNote={(text) => { addInteraction(detail.id, "nota", text); toast.success("Nota registrada"); }}
            onEnrich={() => setEnrichFor(detail)}
            onRegisterTouchpoint={() => setTouchpointTarget({ prospect: detail, tipo: "whatsapp" })}
            onCloseCadence={() => setCloseCadenceTarget(detail)}
          />
        )}
      </Dialog>

      {/* Import preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <ImportPreviewDialog
          rows={previewRows}
          fileName={previewFileName}
          onConfirm={confirmImport}
          onCancel={() => { setPreviewOpen(false); setPreviewRows([]); }}
        />
      </Dialog>

      {/* Import history */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <ImportHistoryDialog open={historyOpen} />
      </Dialog>

      {/* Confirmação pós-WhatsApp: avança status para "Primeiro contato" */}
      <Dialog
        open={!!whatsConfirm}
        onOpenChange={(o) => {
          console.log("[prosp] whatsConfirm:dialog", { open: o, target: whatsConfirm });
          if (!o) setWhatsConfirm(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Foi feito o primeiro contato?</DialogTitle>
            <DialogDescription>
              {whatsConfirm
                ? `Confirme se você conseguiu falar com ${whatsConfirm.company} no WhatsApp para avançar o card.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => {
              console.log("[prosp] whatsConfirm:dismiss", { target: whatsConfirm });
              setWhatsConfirm(null);
            }}>
              Ainda não
            </Button>
            <Button
              className="btn-gradient"
              onClick={() => {
                console.log("[prosp] whatsConfirm:confirm", { target: whatsConfirm });
                if (whatsConfirm) updateStatus(whatsConfirm.id, "primeiro_contato");
                setWhatsConfirm(null);
              }}
            >
              Sim, avançar status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="pointer-events-none fixed bottom-4 right-4 rounded-md bg-card/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow">
          Carregando…
        </div>
      )}

      <EnrichmentDrawer
        open={!!enrichFor}
        onOpenChange={(o) => !o && setEnrichFor(null)}
        cnpj={enrichFor?.cnpj ?? ""}
        prospectId={enrichFor?.id}
        companyName={enrichFor?.company}
        onEnriched={(r) => {
          const pid = enrichFor?.id;
          if (!pid) return;
          const tel = r.profile.telefone_1 || r.profile.telefone_2 || "";
          setCache((prev) => prev.map((x) => {
            if (x.id !== pid) return x;
            return {
              ...x,
              phone: x.phone || tel,
              whatsapp: x.whatsapp || tel,
              email: x.email || r.profile.email || "",
              city: x.city || r.address?.cidade || "",
              state: x.state || r.address?.uf || "",
            };
          }));
          void invalidateCrmCore(qc);
        }}
      />
      {touchpointTarget && (
        <TouchpointModal
          open={!!touchpointTarget}
          onOpenChange={(v) => !v && setTouchpointTarget(null)}
          prospectId={touchpointTarget.prospect.id}
          company={touchpointTarget.prospect.company}
          cadenceStep={(touchpointTarget.prospect.cadenceStep ?? 0) as 0|1|2|3|4|5|6}
          defaultTipo={touchpointTarget.tipo}
          ownerName={user.name}
        />
      )}
      {closeCadenceTarget && (
        <CloseCadenceDialog
          open={!!closeCadenceTarget}
          onOpenChange={(v) => !v && setCloseCadenceTarget(null)}
          prospectId={closeCadenceTarget.id}
          company={closeCadenceTarget.company}
        />
      )}
    </AppShell>

  );
}

function DesktopProspectTable({
  items,
  selected,
  allVisibleSelected,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onWhats,
  onCall,
  onAgendar,
  onConvert,
  onStatus,
  onRemove,
}: {
  items: Prospect[];
  selected: Set<string>;
  allVisibleSelected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpen: (id: string) => void;
  onWhats: (p: Prospect) => void;
  onCall: (p: Prospect) => void;
  onAgendar: (id: string) => void;
  onConvert: (p: Prospect) => void;
  onStatus: (id: string, s: ProspectStatus) => void;
  onRemove: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 64,
    overscan: 8,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });

  return (
    <div className="hidden overflow-x-auto md:block">
      <div className="min-w-[1120px] text-sm">
        <div className="grid grid-cols-[52px_minmax(220px,1.5fr)_minmax(170px,1fr)_minmax(130px,0.8fr)_minmax(110px,0.7fr)_110px_130px_140px_220px] bg-accent/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <div className="px-3 py-3">
            <NativeCheckbox checked={allVisibleSelected} onChange={onToggleSelectAll} ariaLabel="Selecionar todos" />
          </div>
          <div className="px-4 py-3">Empresa</div>
          <div className="px-4 py-3">Contato</div>
          <div className="px-4 py-3">Localização</div>
          <div className="px-4 py-3">Origem</div>
          <div className="px-4 py-3">Potencial</div>
          <div className="px-4 py-3">Status</div>
          <div className="px-4 py-3">Próxima ação</div>
          <div className="px-4 py-3 text-right">Ações</div>
        </div>

        {items.length === 0 ? (
          <div className="border-t border-border/60 px-4 py-16 text-center text-sm text-muted-foreground">
            Nenhuma empresa encontrada.
          </div>
        ) : (
          <div ref={parentRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const p = items[vi.index];
              if (!p) return null;
              return (
                <div
                  key={p.id}
                  data-index={vi.index}
                  className={`absolute left-0 right-0 grid grid-cols-[52px_minmax(220px,1.5fr)_minmax(170px,1fr)_minmax(130px,0.8fr)_minmax(110px,0.7fr)_110px_130px_140px_220px] border-t border-border/60 hover:bg-accent/30 ${selected.has(p.id) ? "bg-primary/5" : ""}`}
                  style={{ transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)` }}
                >
                  <div className="px-3 py-3">
                    <NativeCheckbox checked={selected.has(p.id)} onChange={() => onToggleSelect(p.id)} ariaLabel={`Selecionar ${p.company}`} />
                  </div>
                  <div className="px-4 py-3">
                    <button className="text-left" onClick={() => onOpen(p.id)}>
                      <div className="font-semibold hover:text-primary-glow">{p.company}</div>
                      <div className="text-[11px] text-muted-foreground">{p.segment} · resp. {p.owner}</div>
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <div className="text-xs">{p.whatsapp || p.phone || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{p.email || p.instagram || "—"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(((p.whatsapp || "").replace(/\D/g, "")).length < 10) && (
                        <span className="inline-flex items-center rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300" title="Empresa sem WhatsApp — candidata a enriquecimento">
                          Sem WhatsApp
                        </span>
                      )}
                      {(() => {
                        const isOut = (k: string) => k === "whatsapp" || k === "ligacao" || k === "email";
                        let max = 0;
                        for (const ix of p.interactions ?? []) {
                          if (!isOut(ix.kind)) continue;
                          const t = ix.at ? Date.parse(ix.at) : 0;
                          if (t > max) max = t;
                        }
                        if (!max || Date.now() - max >= 86_400_000) return null;
                        const h = Math.max(1, Math.ceil((86_400_000 - (Date.now() - max)) / 3_600_000));
                        return (
                          <span className="inline-flex items-center rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300" title="Disparo recente — liberará em breve">
                            ⏱ libera em {h}h
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="px-4 py-3 text-xs">{p.city ? `${p.city} - ${p.state}` : p.state || "—"}</div>
                  <div className="px-4 py-3 text-xs">{p.source}</div>
                  <div className="px-4 py-3"><PotentialBadge p={p.potential} /></div>
                  <div className="px-4 py-3"><StatusBadge status={p.status} /></div>
                  <div className="px-4 py-3 text-xs">
                    <NextActionCell next={p.nextContactAt ?? null} status={p.cadenceStatus} />
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <RowActions
                        p={p}
                        onWhats={onWhats}
                        onCall={onCall}
                        onAgendar={() => onAgendar(p.id)}
                        onConvert={() => onConvert(p)}
                        onStatus={onStatus}
                        onRemove={() => onRemove(p.id)}
                        onOpen={() => onOpen(p.id)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Apagar ${p.company}`}
                        onClick={() => {
                          if (window.confirm(`Apagar "${p.company}"? Esta ação não pode ser desfeita.`)) onRemove(p.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NextActionCell({
  next,
  status,
}: {
  next: string | null;
  status?: "ativo" | "pausado" | "encerrado";
}) {
  if (status === "encerrado") return <span className="text-muted-foreground">Encerrada</span>;
  if (status === "pausado") return <span className="text-muted-foreground">Pausada</span>;
  const { text, tone } = proximaAcaoLabel(next);
  const cls =
    tone === "overdue" ? "text-rose-300" :
    tone === "today" ? "text-amber-300" :
    tone === "tomorrow" ? "text-amber-200/80" :
    tone === "soon" ? "text-emerald-300/80" :
    "text-muted-foreground";
  return <span className={cls}>{text}</span>;
}

const RowActions = memo(function RowActions({
  p, onWhats, onCall, onAgendar, onConvert, onStatus, onRemove, onOpen,
}: {
  p: Prospect;
  onWhats: (p: Prospect) => void;
  onCall: (p: Prospect) => void;
  onAgendar: () => void;
  onConvert: () => void;
  onStatus: (id: string, s: ProspectStatus) => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400" title="WhatsApp" onClick={() => onWhats(p)}>
        <MessageSquare className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" title="Ligar" onClick={() => onCall(p)}>
        <Phone className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" title="Agendar" onClick={onAgendar}>
        <CalendarPlus className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-glow" title="Converter para Lead" onClick={onConvert}>
        <Sparkles className="h-4 w-4" />
      </Button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        {menuOpen && (
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen} className="text-xs">Abrir detalhes</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px]">Alterar status</DropdownMenuLabel>
            {STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onStatus(p.id, s)} className="text-xs">
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />{STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-destructive" onClick={onRemove}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    </div>
  );
});

function KanbanView({
  prospects, onOpen, onMove,
}: {
  prospects: Prospect[];
  onOpen: (id: string) => void;
  onMove: (id: string, status: ProspectStatus) => void;
}) {
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDrop = (e: React.DragEvent, status: ProspectStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) onMove(id, status);
  };
  return (
    <section className="mt-4 overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {STATUSES.map((s) => {
          const items = prospects.filter((p) => p.status === s);
          return (
            <div key={s}
              className="w-[280px] shrink-0 surface-card flex flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, s)}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <StatusBadge status={s} />
                </div>
                <span className="text-[11px] text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                {items.length === 0 && (
                  <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-[11px] text-muted-foreground">
                    Arraste empresas aqui
                  </div>
                )}
                {items.map((p) => (
                  <div key={p.id}
                    draggable onDragStart={(e) => onDragStart(e, p.id)}
                    onClick={() => onOpen(p.id)}
                    className="cursor-grab rounded-lg border border-border bg-card/60 p-3 transition hover:border-primary/40 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">{p.company}</p>
                      <PotentialBadge p={p.potential} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{p.segment}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {p.city ? `${p.city} - ${p.state}` : p.state || "—"} · {p.owner}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DetailDialog({
  p, onWhats, onCall, onStatus, onConvert, onAddNote, onEnrich, onRegisterTouchpoint, onCloseCadence,
}: {
  p: Prospect;
  onWhats: () => void;
  onCall: () => void;
  onStatus: (s: ProspectStatus) => void;
  onConvert: () => void;
  onAddNote: (text: string) => void;
  onEnrich: () => void;
  onRegisterTouchpoint: () => void;
  onCloseCadence: () => void;
}) {
  const [note, setNote] = useState("");
  const timeline = p.interactions ?? [];
  const proxima = proximaAcaoLabel(p.nextContactAt ?? null);
  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-xl">{p.company}</DialogTitle>
            <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span>{p.segment}</span>
              <span className="opacity-50">·</span>
              <span>resp. {p.owner}</span>
              <span className="opacity-50">·</span>
              <PotentialBadge p={p.potential} />
              <StatusBadge status={p.status} />
              <span className="opacity-50">·</span>
              <span className={
                proxima.tone === "overdue" ? "text-rose-300" :
                proxima.tone === "today"   ? "text-amber-300" :
                "text-muted-foreground"
              }>
                Próxima ação: {proxima.text}
              </span>
            </DialogDescription>
          </div>
          <Button size="sm" className="btn-gradient h-8 text-xs" onClick={onEnrich}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Enriquecer Lead
          </Button>
        </div>
      </DialogHeader>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1.2fr]">
        {/* Contato */}
        <div className="space-y-3">
          <div className="surface-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
            <ul className="mt-2 space-y-2 text-xs">
              <li className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5 text-emerald-400" /> {p.whatsapp || "—"}</li>
              <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {p.phone || "—"}</li>
              <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {p.email || "—"}</li>
              <li className="flex items-center gap-2"><Instagram className="h-3.5 w-3.5" /> {p.instagram || "—"}</li>
              <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {p.city ? `${p.city} - ${p.state}` : p.state || "—"}</li>
            </ul>
          </div>

          <div className="surface-card p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ações</p>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onWhats}>
                <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onCall}>
                <Phone className="mr-1.5 h-3.5 w-3.5" /> Ligar
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onStatus("agendado")}>
                <CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Agendar
              </Button>
              <Button size="sm" className="btn-gradient h-8 text-xs" onClick={onConvert}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Converter
              </Button>
            </div>
            <Select value={p.status} onValueChange={(v) => onStatus(v as ProspectStatus)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="btn-gradient h-9 w-full text-xs" onClick={onRegisterTouchpoint}>
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Registrar contato (cadência)
            </Button>
            {p.cadenceStatus !== "encerrado" && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full text-xs border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                onClick={onCloseCadence}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Encerrar cadência
              </Button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="surface-card flex flex-col p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline (Cadência)</p>
          <div className="mt-3">
            <ProspectTimeline prospectId={p.id} />
          </div>
          <div className="my-4 border-t border-border/60"></div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notas internas</p>

          <div className="mt-2 space-y-2">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Adicionar nota ou observação…" className="min-h-[60px] text-xs" />
            <div className="flex justify-end">
              <Button size="sm" className="btn-gradient h-8 text-xs"
                onClick={() => { if (!note.trim()) return; onAddNote(note.trim()); setNote(""); }}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Registrar
              </Button>
            </div>
          </div>

          <div className="mt-3 max-h-[340px] flex-1 overflow-y-auto pr-1">
            {timeline.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                Sem interações ainda. Use os botões ao lado para começar.
              </div>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                {timeline.map((ix) => {
                  const Icon = INTERACTION_ICON[ix.kind] ?? StickyNote;
                  return (
                    <li key={ix.id} className="relative">
                      <span className="absolute -left-[22px] grid h-6 w-6 place-items-center rounded-full border border-border bg-card">
                        <Icon className="h-3 w-3 text-primary-glow" />
                      </span>
                      <div className="rounded-md border border-border/60 bg-card/50 p-2.5">
                        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>{INTERACTION_LABEL[ix.kind]}</span>
                          <span>{fmtBR(ix.at)} · {ix.by}</span>
                        </div>
                        <p className="mt-1 text-xs">{ix.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

function NewProspectDialog({
  form, setForm, onCreate,
}: {
  form: Omit<Prospect, "id" | "createdAt">;
  setForm: (f: Omit<Prospect, "id" | "createdAt">) => void;
  onCreate: () => void;
}) {
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Nova empresa na prospecção</DialogTitle>
        <DialogDescription>Cadastre uma oportunidade e evolua o status conforme a abordagem.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Nome da empresa *</Label>
          <Input autoFocus autoComplete="organization" value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Ex: Padaria Pão Quente" />
        </div>
        <div className="space-y-1.5"><Label>Segmento</Label>
          <Select value={form.segment} onValueChange={(v) => set("segment", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Responsável</Label>
          <Input autoComplete="name" value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Nome do consultor" />
        </div>
        <div className="space-y-1.5"><Label>WhatsApp</Label>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 99999-0000" />
        </div>
        <div className="space-y-1.5"><Label>Telefone</Label>
          <Input type="tel" inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 3333-0000" />
        </div>
        <div className="space-y-1.5"><Label>Email</Label>
          <Input type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@empresa.com" />
        </div>
        <div className="space-y-1.5"><Label>Instagram</Label>
          <Input autoCapitalize="none" autoCorrect="off" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@empresa" />
        </div>
        <div className="space-y-1.5"><Label>Cidade</Label>
          <Input autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" />
        </div>
        <div className="space-y-1.5"><Label>Estado</Label>
          <Select value={form.state} onValueChange={(v) => set("state", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Origem</Label>
          <Select value={form.source} onValueChange={(v) => set("source", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Potencial</Label>
          <Select value={form.potential} onValueChange={(v) => set("potential", v as ProspectPotential)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{POTENTIALS.map((p) => <SelectItem key={p} value={p}>{POTENTIAL_LABEL[p]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 border-t border-border/60 bg-background px-4 py-3 sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button onClick={onCreate} className="btn-gradient w-full sm:w-auto">
          <Plus className="mr-1.5 h-4 w-4" /> Cadastrar empresa
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ImportPreviewDialog({
  rows, fileName, onConfirm, onCancel,
}: {
  rows: PreviewRow[];
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);
  const duplicates = validRows.filter((r) => r.matchId).length;
  const newOnes = validRows.length - duplicates;

  return (
    <DialogContent className="max-w-5xl sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary-glow" /> Pré-visualização da importação
        </DialogTitle>
        <DialogDescription>
          <span className="font-medium">{fileName}</span> — {rows.length} linha(s) lidas ·{" "}
          <span className="text-emerald-400">{newOnes} novas</span> ·{" "}
          <span className="text-amber-300">{duplicates} duplicadas (atualizar campos vazios)</span> ·{" "}
          <span className="text-rose-400">{errorRows.length} com erro</span>
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="sticky top-0 bg-accent text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-2">Linha</th>
              <th className="px-2 py-2">Empresa</th>
              <th className="px-2 py-2">CNPJ</th>
              <th className="px-2 py-2">Cidade/UF</th>
              <th className="px-2 py-2">Segmento</th>
              <th className="px-2 py-2">Contato</th>
              <th className="px-2 py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rowIndex} className="border-t border-border/60">
                <td className="px-2 py-1.5 text-muted-foreground">{r.rowIndex}</td>
                <td className="px-2 py-1.5 font-medium">{r.data.company || "—"}</td>
                <td className="px-2 py-1.5">{r.data.cnpj || "—"}</td>
                <td className="px-2 py-1.5">{r.data.city ? `${r.data.city}/${r.data.state}` : r.data.state || "—"}</td>
                <td className="px-2 py-1.5">{r.data.segment}</td>
                <td className="px-2 py-1.5">{r.data.whatsapp || r.data.phone || "—"}</td>
                <td className="px-2 py-1.5">
                  {r.errors.length ? (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-300">
                      {r.errors.join(", ")}
                    </span>
                  ) : r.matchId ? (
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                      Duplicada
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      Nova
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 flex-col gap-2 border-t border-border/60 bg-background px-4 py-3 sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="ghost" onClick={onCancel} disabled={submitting} className="w-full sm:w-auto">Cancelar</Button>
        <Button
          className="btn-gradient w-full sm:w-auto"
          disabled={submitting || validRows.length === 0}
          onClick={async () => { setSubmitting(true); await onConfirm(); setSubmitting(false); }}
        >
          {submitting ? "Salvando…" : `Confirmar (${validRows.length})`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ImportHistoryDialog({ open }: { open: boolean }) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listImports()
      .then(setLogs)
      .catch((e) => toast.error(`Erro: ${e.message ?? e}`))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary-glow" /> Histórico de importações
        </DialogTitle>
        <DialogDescription>Últimas 50 importações desta conta.</DialogDescription>
      </DialogHeader>
      <div className="max-h-[55vh] overflow-auto">
        {loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Carregando…</p>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma importação ainda.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Arquivo</th>
                <th className="px-2 py-2">Por</th>
                <th className="px-2 py-2 text-right">Linhas</th>
                <th className="px-2 py-2 text-right">Novas</th>
                <th className="px-2 py-2 text-right">Atualizadas</th>
                <th className="px-2 py-2 text-right">Ignoradas</th>
                <th className="px-2 py-2 text-right">Erros</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="px-2 py-1.5">{fmtBR(l.createdAt)}</td>
                  <td className="px-2 py-1.5 font-medium">{l.fileName}</td>
                  <td className="px-2 py-1.5">{l.performedBy}</td>
                  <td className="px-2 py-1.5 text-right">{l.totalRows}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-400">{l.inserted}</td>
                  <td className="px-2 py-1.5 text-right text-amber-300">{l.updated}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{l.skipped}</td>
                  <td className="px-2 py-1.5 text-right text-rose-400">{l.errorCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DialogContent>
  );
}


const MobileProspectRow = memo(function MobileProspectRow({
  p, isSelected, busy, onToggleSelect, onOpen, onWhats, onCall, onAgendar, onConvert, onStatus, onRemove, onEnrich,
}: {
  p: Prospect;
  isSelected: boolean;
  busy?: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onWhats: (p: Prospect) => void;
  onCall: (p: Prospect) => void;
  onAgendar: (id: string) => void;
  onConvert: (p: Prospect) => void;
  onStatus: (id: string, s: ProspectStatus) => void;
  onRemove: (id: string) => void;
  onEnrich: (p: Prospect) => void;
}) {
  const noWhats = ((p.whatsapp || "").replace(/\D/g, "")).length < 10;
  return (
    <div className={`flex gap-3 border-b border-border/60 p-3 ${isSelected ? "bg-primary/5" : ""}`}>
      <NativeCheckbox
        checked={isSelected}
        onChange={() => onToggleSelect(p.id)}
        ariaLabel={`Selecionar ${p.company}`}
        className="mt-1 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <button className="block w-full text-left" onClick={() => onOpen(p.id)}>
          <div className="truncate text-sm font-semibold">{p.company}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {p.segment} · {p.city ? `${p.city}-${p.state}` : p.state || "—"}
          </div>
        </button>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PotentialBadge p={p.potential} />
          <StatusBadge status={p.status} />
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">
          {p.whatsapp || p.phone || p.email || p.instagram || "—"}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Button
          size="icon"
          variant={noWhats ? "default" : "ghost"}
          className={`h-9 w-9 ${noWhats ? "bg-amber-500 text-amber-950 hover:bg-amber-400" : "text-primary-glow"}`}
          title={noWhats ? "Enriquecer (sem WhatsApp)" : "Enriquecer dados via CNPJ"}
          aria-label={`Enriquecer ${p.company}`}
          disabled={!!busy}
          onClick={(e) => { e.stopPropagation(); onEnrich(p); }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        </Button>
        <RowActions
          p={p}
          onWhats={onWhats}
          onCall={onCall}
          onAgendar={() => onAgendar(p.id)}
          onConvert={() => onConvert(p)}
          onStatus={onStatus}
          onRemove={() => onRemove(p.id)}
          onOpen={() => onOpen(p.id)}
        />
      </div>
    </div>
  );
});

function MobileProspectList({
  items, selected, busyIds, onToggleSelect, onOpen, onWhats, onCall, onAgendar, onConvert, onStatus, onRemove, onEnrich,
}: {
  items: Prospect[];
  selected: Set<string>;
  busyIds?: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onWhats: (p: Prospect) => void;
  onCall: (p: Prospect) => void;
  onAgendar: (id: string) => void;
  onConvert: (p: Prospect) => void;
  onStatus: (id: string, s: ProspectStatus) => void;
  onRemove: (id: string) => void;
  onEnrich: (p: Prospect) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 116,
    overscan: 6,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  });

  if (items.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        Nenhuma empresa encontrada.
      </div>
    );
  }

  // Small lists: render directly (avoid virtualization overhead)
  if (items.length <= 60) {
    return (
      <div>
        {items.map((p) => (
          <MobileProspectRow
            key={p.id}
            p={p}
            isSelected={selected.has(p.id)}
            busy={busyIds?.has(p.id)}
            onToggleSelect={onToggleSelect}
            onOpen={onOpen}
            onWhats={onWhats}
            onCall={onCall}
            onAgendar={onAgendar}
            onConvert={onConvert}
            onStatus={onStatus}
            onRemove={onRemove}
            onEnrich={onEnrich}
          />
        ))}
      </div>
    );
  }

  const virtualItems = virtualizer.getVirtualItems();
  return (
    <div ref={parentRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualItems.map((vi) => {
        const p = items[vi.index];
        if (!p) return null;
        return (
          <div
            key={p.id}
            data-index={vi.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${vi.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <MobileProspectRow
              p={p}
              isSelected={selected.has(p.id)}
              busy={busyIds?.has(p.id)}
              onToggleSelect={onToggleSelect}
              onOpen={onOpen}
              onWhats={onWhats}
              onCall={onCall}
              onAgendar={onAgendar}
              onConvert={onConvert}
              onStatus={onStatus}
              onRemove={onRemove}
              onEnrich={onEnrich}
            />
          </div>
        );
      })}
    </div>
  );
}
