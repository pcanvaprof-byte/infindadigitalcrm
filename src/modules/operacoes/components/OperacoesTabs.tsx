import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  KanbanSquare,
  KeyRound,
  DollarSign,
  Calendar,
  BarChart3,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type Tab = {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  soon?: boolean;
};

export const OPERACOES_TABS: Tab[] = [
  { to: "/operacoes/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/operacoes/clientes", label: "Clientes", icon: Users },
  { to: "/operacoes/trafego", label: "Tráfego", icon: Megaphone },
  { to: "/operacoes/kanban", label: "Kanban", icon: KanbanSquare },
  { to: "/operacoes/credenciais", label: "Credenciais", icon: KeyRound, soon: true },
  { to: "/operacoes/financeiro", label: "Financeiro", icon: DollarSign, soon: true },
  { to: "/operacoes/agenda", label: "Agenda", icon: Calendar, soon: true },
  { to: "/operacoes/relatorios", label: "Relatórios", icon: BarChart3, soon: true },
];

export function OperacoesTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Operações"
      className="sticky top-0 z-10 -mx-3 mb-4 flex items-center gap-1 overflow-x-auto border-b border-border bg-background/80 px-3 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {OPERACOES_TABS.map((t) => {
        const Icon = t.icon;
        const active = pathname === t.to || pathname.startsWith(t.to + "/");
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`group inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
              active
                ? "border-primary/40 bg-primary/10 text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
                : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${active ? "text-primary-glow" : ""}`} />
            <span>{t.label}</span>
            {t.soon && (
              <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/80">
                Em breve
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}