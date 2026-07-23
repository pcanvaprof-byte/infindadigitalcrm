import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import {
  KeyRound,
  Copy,
  Check,
  Users as UsersIcon,
  RefreshCw,
  CalendarPlus,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  History as HistoryIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  listOrgUsers,
  resetMemberTempPassword,
  renewUserAccess,
  provisionMemberUser,
  listUserAccessEvents,
  type OrgUserRow,
  type UserAccessEvent,
} from "@/lib/access/access.functions";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrgRole, isOwnerOrAdmin } from "@/lib/org/plans";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [{ title: "Usuários — INFINDA" }],
  }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { role } = useOrgRole();

  if (role && !isOwnerOrAdmin(role)) {
    return (
      <AppShell title="Usuários">
        <div className="mx-auto max-w-xl p-8 text-center text-muted-foreground">
          Acesso restrito a administradores.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Usuários" subtitle="Gestão de acesso da organização">
      <UsuariosPanel />
    </AppShell>
  );
}

function UsuariosPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listOrgUsers);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OrgUserRow["derivedStatus"]>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<OrgUserRow | null>(null);
  const [renewTarget, setRenewTarget] = useState<OrgUserRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<OrgUserRow | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["org-users"],
    queryFn: async () => (await list()) as { users: OrgUserRow[] },
    staleTime: 30_000,
  });

  const users = data?.users ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { total: users.length };
    for (const u of users) c[u.derivedStatus] = (c[u.derivedStatus] ?? 0) + 1;
    return c;
  }, [users]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "all" && u.derivedStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.fullName ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, filter, statusFilter]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["org-users"] });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
              <UsersIcon className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold">Usuários da organização</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Veja o status de acesso de cada usuário, renove trials, gere senhas temporárias e
            adicione novos membros.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Novo usuário
          </Button>
        </div>
      </header>

      <StatusStrip
        counts={counts}
        active={statusFilter}
        onSelect={(s) => setStatusFilter(s)}
      />

      <div className="flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nome, e-mail ou papel…"
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} de {users.length}
        </span>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Não foi possível carregar a lista de usuários. {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando usuários…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">Papel</th>
                <th className="px-4 py-3 text-left">Acesso</th>
                <th className="px-4 py-3 text-left">Expira</th>
                <th className="px-4 py-3 text-left">Último login</th>
                <th className="px-4 py-3 text-left">Último evento</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <UserRow
                  key={u.userId}
                  user={u}
                  onReset={() => setResetTarget(u)}
                  onRenew={() => setRenewTarget(u)}
                  onHistory={() => setHistoryTarget(u)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ResetPasswordDialog
        user={resetTarget}
        onClose={() => setResetTarget(null)}
        onDone={invalidate}
      />
      <RenewAccessDialog
        user={renewTarget}
        onClose={() => setRenewTarget(null)}
        onDone={invalidate}
      />
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} onDone={invalidate} />
      <HistorySheet user={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}

// -------- Sub-componentes --------

const STATUS_META: Record<
  OrgUserRow["derivedStatus"],
  { label: string; className: string; icon?: typeof ShieldCheck }
> = {
  interno: { label: "Interno", className: "bg-slate-500/15 text-slate-700 border-slate-500/30", icon: ShieldCheck },
  pago: { label: "Pago", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: ShieldCheck },
  demo: { label: "Demo", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  trial: { label: "Trial", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  expirado: { label: "Expirado", className: "bg-red-500/15 text-red-700 border-red-500/30", icon: ShieldAlert },
  suspenso: { label: "Suspenso", className: "bg-red-500/15 text-red-700 border-red-500/30", icon: ShieldAlert },
  sem_acesso: { label: "Sem acesso", className: "bg-muted text-muted-foreground border-border" },
};

function StatusStrip({
  counts,
  active,
  onSelect,
}: {
  counts: Record<string, number>;
  active: "all" | OrgUserRow["derivedStatus"];
  onSelect: (s: "all" | OrgUserRow["derivedStatus"]) => void;
}) {
  const items: Array<{ key: "all" | OrgUserRow["derivedStatus"]; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "interno", label: STATUS_META.interno.label },
    { key: "pago", label: STATUS_META.pago.label },
    { key: "demo", label: STATUS_META.demo.label },
    { key: "trial", label: STATUS_META.trial.label },
    { key: "expirado", label: STATUS_META.expirado.label },
    { key: "suspenso", label: STATUS_META.suspenso.label },
    { key: "sem_acesso", label: STATUS_META.sem_acesso.label },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const n = it.key === "all" ? counts.total ?? 0 : counts[it.key] ?? 0;
        const isActive = active === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onSelect(it.key)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              isActive
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {it.label} <span className="ml-1 font-medium">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

function UserRow({
  user,
  onReset,
  onRenew,
  onHistory,
}: {
  user: OrgUserRow;
  onReset: () => void;
  onRenew: () => void;
  onHistory: () => void;
}) {
  const meta = STATUS_META[user.derivedStatus];
  const StatusIcon = meta.icon;
  return (
    <tr className="border-t border-border/60 hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{user.fullName ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{user.email ?? "sem e-mail"}</div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className="capitalize">
          {user.role}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
        >
          {StatusIcon ? <StatusIcon className="h-3 w-3" /> : null}
          {meta.label}
        </span>
        {user.access?.mustChangePassword ? (
          <div className="mt-1 text-[11px] text-amber-600">Precisa trocar senha</div>
        ) : null}
        {user.access?.planName ? (
          <div className="mt-1 text-[11px] text-muted-foreground">{user.access.planName}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-xs">
        {user.access?.expiresAt ? (
          <>
            <div>{formatDate(user.access.expiresAt)}</div>
            {user.daysRemaining != null ? (
              <div
                className={
                  user.daysRemaining <= 0
                    ? "text-destructive"
                    : user.daysRemaining <= 3
                    ? "text-amber-600"
                    : "text-muted-foreground"
                }
              >
                {user.daysRemaining <= 0
                  ? `expirou há ${Math.abs(user.daysRemaining)}d`
                  : `${user.daysRemaining}d restantes`}
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {user.lastSignInAt ? formatDateTime(user.lastSignInAt) : "nunca"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {user.lastEvent ? (
          <>
            <div className="font-medium text-foreground/80">{user.lastEvent.event}</div>
            <div>{formatDateTime(user.lastEvent.created_at)}</div>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <Button variant="outline" size="sm" onClick={onHistory}>
            <HistoryIcon className="mr-1.5 h-3.5 w-3.5" />
            Histórico
          </Button>
          <Button variant="outline" size="sm" onClick={onRenew}>
            <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
            Renovar
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            Senha
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: OrgUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const reset = useServerFn(resetMemberTempPassword);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setResult(null);
    setCopied(false);
    onClose();
  };

  const submit = async () => {
    if (!user?.email) {
      toast.error("Usuário sem e-mail.");
      return;
    }
    setBusy(true);
    try {
      const r = (await reset({ data: { email: user.email, requireChange: true } })) as {
        email: string;
        tempPassword: string;
      };
      setResult(r);
      onDone();
      toast.success("Senha temporária gerada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar senha.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => (!v ? close() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar senha temporária</DialogTitle>
          <DialogDescription>
            Uma nova senha será gerada para <strong>{user?.email}</strong>. Ele será obrigado a
            alterá-la no próximo login.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-base">
                {result.tempPassword}
              </code>
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Copie e envie ao usuário por canal seguro. Ela só aparece agora.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {result ? "Fechar" : "Cancelar"}
          </Button>
          {!result && (
            <Button onClick={submit} disabled={busy}>
              {busy ? "Gerando…" : "Gerar senha"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenewAccessDialog({
  user,
  onClose,
  onDone,
}: {
  user: OrgUserRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const renew = useServerFn(renewUserAccess);
  const [days, setDays] = useState(30);
  const [planName, setPlanName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await renew({
        data: {
          userId: user.userId,
          days,
          planName: planName.trim() || undefined,
        },
      });
      toast.success("Acesso renovado.");
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao renovar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Renovar acesso</DialogTitle>
            <DialogDescription>
              Estende a data de expiração de <strong>{user?.email ?? user?.fullName}</strong>. O
              tempo é somado à expiração atual (ou à data de hoje se já expirou).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="days">Dias a adicionar</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 0)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan">Plano (opcional)</Label>
              <Input
                id="plan"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Plano Único"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || days <= 0}>
              {busy ? "Renovando…" : "Renovar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteUserDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const provision = useServerFn(provisionMemberUser);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [trialDays, setTrialDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string | null } | null>(
    null,
  );

  const close = () => {
    setResult(null);
    setEmail("");
    setFullName("");
    setTrialDays(30);
    onOpenChange(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = (await provision({
        data: { email: email.trim(), fullName: fullName.trim(), trialDays },
      })) as { email: string; tempPassword: string | null; created: boolean };
      setResult({ email: r.email, tempPassword: r.tempPassword });
      onDone();
      toast.success(r.created ? "Usuário criado." : "Usuário já existente vinculado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar usuário.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? close() : onOpenChange(v))}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Cria uma conta com trial e vincula à sua organização. Se o e-mail já existir, o
              usuário só é vinculado (sem nova senha).
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-3 py-2">
              <div className="text-sm">
                Usuário: <strong>{result.email}</strong>
              </div>
              {result.tempPassword ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="text-xs text-muted-foreground">Senha temporária</div>
                  <code className="mt-1 block rounded-md border border-border bg-background px-3 py-2 font-mono">
                    {result.tempPassword}
                  </code>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Usuário já existia — nenhuma senha nova foi gerada.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-name">Nome completo</Label>
                <Input
                  id="new-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-email">E-mail</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trial-days">Trial (dias)</Label>
                <Input
                  id="trial-days"
                  type="number"
                  min={1}
                  max={365}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value) || 0)}
                  required
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {result ? "Fechar" : "Cancelar"}
            </Button>
            {!result && (
              <Button type="submit" disabled={busy}>
                {busy ? "Criando…" : "Criar usuário"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// -------- Helpers --------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// -------- Histórico (timeline de eventos) --------

const EVENT_META: Record<string, { label: string; className: string }> = {
  ACCESS_CREATED: { label: "Acesso criado", className: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  ACCESS_RENEWED: { label: "Acesso renovado", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  ACCESS_EXPIRED: { label: "Acesso expirado", className: "bg-red-500/15 text-red-700 border-red-500/30" },
  ACCESS_SUSPENDED: { label: "Acesso suspenso", className: "bg-red-500/15 text-red-700 border-red-500/30" },
  PASSWORD_RESET: { label: "Senha redefinida", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  PASSWORD_CHANGED: { label: "Senha alterada", className: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
  DEMO_STARTED: { label: "Demo iniciada", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  DEMO_CONVERTED: { label: "Demo convertida em pago", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  PAYMENT_APPROVED: { label: "Pagamento aprovado", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  PAYMENT_REJECTED: { label: "Pagamento rejeitado", className: "bg-red-500/15 text-red-700 border-red-500/30" },
  SUBSCRIPTION_AUTHORIZED: { label: "Assinatura autorizada", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  SUBSCRIPTION_PAUSED: { label: "Assinatura pausada", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  SUBSCRIPTION_CANCELLED: { label: "Assinatura cancelada", className: "bg-red-500/15 text-red-700 border-red-500/30" },
};

function eventMeta(event: string) {
  return (
    EVENT_META[event] ?? {
      label: event.replace(/_/g, " ").toLowerCase(),
      className: "bg-muted text-muted-foreground border-border",
    }
  );
}

function HistorySheet({
  user,
  onClose,
}: {
  user: OrgUserRow | null;
  onClose: () => void;
}) {
  const fetchEvents = useServerFn(listUserAccessEvents);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["user-access-events", user?.userId ?? "none"],
    enabled: !!user,
    queryFn: async () =>
      (await fetchEvents({ data: { userId: user!.userId, limit: 200 } })) as {
        events: UserAccessEvent[];
      },
    staleTime: 15_000,
  });

  const events = data?.events ?? [];

  return (
    <Sheet open={!!user} onOpenChange={(v) => (!v ? onClose() : null)}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Histórico de acesso</SheetTitle>
          <SheetDescription>
            Timeline completa dos eventos de <strong>{user?.email ?? user?.fullName ?? "—"}</strong>.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {isLoading ? "Carregando…" : `${events.length} evento${events.length === 1 ? "" : "s"}`}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <ScrollArea className="mt-3 h-[calc(100vh-11rem)] pr-2">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Falha ao carregar histórico: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : events.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum evento registrado para este usuário.
            </div>
          ) : (
            <ol className="relative space-y-4 border-l border-border/70 pl-4">
              {events.map((ev) => {
                const meta = eventMeta(ev.event);
                return (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.className}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(ev.createdAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-muted-foreground/80">
                      {ev.event}
                    </div>
                    {ev.meta ? <MetaBlock raw={ev.meta} /> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MetaBlock({ raw }: { raw: string }) {
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* keep as-is */
  }
  if (!pretty || pretty === "null" || pretty === "{}") return null;
  return (
    <pre className="mt-1.5 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
      {pretty}
    </pre>
  );
}