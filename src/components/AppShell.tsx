import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Search,
  Target,
  ListChecks,
  FileText,
  Share2,
  Bot,
  Rocket,
  Settings,
  Bell,
  LogOut,
  Menu,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth, ROLE_LABEL } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { to: "/crm", label: "CRM Comercial", icon: Users, enabled: true },
  { to: "/prospeccao", label: "Prospecção", icon: Search, enabled: true },
  { to: "/metas", label: "Metas", icon: Target, enabled: true },
  { to: "/tarefas", label: "Tarefas", icon: ListChecks, enabled: true },
  { to: "/briefings", label: "Briefings Comerciais", icon: FileText, enabled: true },
  { to: "/kickoff", label: "Kickoff Produção", icon: Rocket, enabled: true },
  { to: "/propostas", label: "Propostas", icon: FileText, enabled: false },
  { to: "/indicacoes", label: "Indicações", icon: Share2, enabled: false },
  { to: "/ia", label: "IA Comercial", icon: Bot, enabled: false },
  { to: "/configuracoes", label: "Configurações", icon: Settings, enabled: false },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
        const base =
          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all";
        if (!item.enabled) {
          return (
            <button
              key={item.to}
              disabled
              className={`${base} cursor-not-allowed text-muted-foreground/50`}
              title="Em breve"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-70">Em breve</span>
            </button>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`${base} ${
              active
                ? "bg-sidebar-accent text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-foreground"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${active ? "text-primary-glow" : "text-muted-foreground group-hover:text-foreground"}`}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <p className="px-6 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Operação
        </p>
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border p-4">
        <div className="surface-card p-3">
          <p className="text-xs font-semibold">Plano Pro</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Multi-tenant · IA inclusa · Suporte premium
          </p>
        </div>
      </div>
    </aside>
  );
}

export function AppShell({ children, title, subtitle, actions }: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.name ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <Sidebar />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="hidden md:block" />

          <div className="flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary-glow" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border bg-card px-1.5 py-1 pr-3 transition-colors hover:bg-accent">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--gradient-primary)] text-xs font-bold text-primary-foreground">
                    {initials || "IN"}
                  </span>
                  <span className="hidden text-xs font-medium sm:block">{user?.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm">{user?.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {user ? ROLE_LABEL[user.role] : ""}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate({ to: "/login", replace: true });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
