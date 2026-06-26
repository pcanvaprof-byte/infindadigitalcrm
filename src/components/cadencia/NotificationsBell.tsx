import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, AlertTriangle, Clock, MessageSquareReply, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  listNotifications,
  refreshNotifications,
  markNotificationHandled,
  markAllNotificationsHandled,
  type CadNotification,
  type CadNotifKind,
} from "@/lib/cadencia/api";

const DEFAULT_KIND_META: { label: string; Icon: typeof Bell; tone: string } = {
  label: "Notificação",
  Icon: Bell,
  tone: "text-muted-foreground",
};

const KIND_META: Record<CadNotifKind, { label: string; Icon: typeof Bell; tone: string }> = {
  overdue: { label: "Follow-up vencido", Icon: Clock, tone: "text-amber-400" },
  last_attempt: { label: "Última tentativa", Icon: AlertTriangle, tone: "text-rose-400" },
  response_pending: { label: "Resposta sem retorno", Icon: MessageSquareReply, tone: "text-cyan-400" },
};

function kindMeta(kind: string | null | undefined) {
  return kind && kind in KIND_META
    ? KIND_META[kind as CadNotifKind]
    : DEFAULT_KIND_META;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function NotificationsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // gera novas notificações periodicamente
  const refreshM = useMutation({ mutationFn: refreshNotifications });
  useEffect(() => {
    refreshM.mutate(undefined, {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["cad-notifications"] }),
    });
    const i = setInterval(() => {
      refreshM.mutate(undefined, {
        onSuccess: () => qc.invalidateQueries({ queryKey: ["cad-notifications"] }),
      });
    }, 60_000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = useQuery({
    queryKey: ["cad-notifications"],
    queryFn: listNotifications,
    refetchInterval: 30_000,
  });
  const items = Array.isArray(q.data) ? q.data : [];
  const count = items.length;

  const handleM = useMutation({
    mutationFn: (id: string) => markNotificationHandled(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cad-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const handleAllM = useMutation({
    mutationFn: markAllNotificationsHandled,
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["cad-notifications"] });
      toast.success(`${n} notificação(ões) tratada(s)`);
    },
  });

  function openLead(n: CadNotification) {
    navigate({ to: "/cadencia" });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="tap-target relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Notificações</div>
          {count > 0 && (
            <Button size="sm" variant="ghost" onClick={() => handleAllM.mutate()} disabled={handleAllM.isPending}>
              <CheckCheck className="h-3 w-3 mr-1" /> Tratar todas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {q.isLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Carregando…</div>
          ) : q.error ? (
            <div className="p-4 text-center text-xs text-amber-300">
              Notificações indisponíveis temporariamente.
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Sem follow-ups pendentes 🎉
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const meta = kindMeta(n.kind);
                const Icon = meta.Icon;
                return (
                  <li key={n.id} className="p-3 hover:bg-accent/40 transition-colors">
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 ${meta.tone}`} />
                      <button onClick={() => openLead(n)} className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{n.empresa}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {meta.label}
                          {n.kind === "overdue" && n.next_action_at && ` · venceu ${fmt(n.next_action_at)}`}
                          {n.kind === "last_attempt" && ` · followup_7`}
                          {n.kind === "response_pending" && n.last_response_at && ` · respondeu ${fmt(n.last_response_at)}`}
                        </div>
                        {n.responsavel && (
                          <div className="text-[11px] text-muted-foreground truncate">{n.responsavel}</div>
                        )}
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        title="Marcar como tratado"
                        onClick={() => handleM.mutate(n.id)}
                        disabled={handleM.isPending}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}