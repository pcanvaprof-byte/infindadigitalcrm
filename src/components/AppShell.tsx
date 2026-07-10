import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
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
  LogOut,
  ShieldAlert,
  Menu,
  Package,
  FileSignature,
  Repeat2,
  GitBranch,
  UserCog,
  KeyRound,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Briefcase } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth, ROLE_LABEL } from "@/lib/auth-context";
import { APP_VERSION_LABEL } from "@/lib/version";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { MobileNav } from "./MobileNav";
import { OrgSwitcher } from "./org/OrgSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NotificationsBell } from "./cadencia/NotificationsBell";
import { ROUTE_FEATURE, planAllows, useActiveOrg, PLAN_LABEL } from "@/lib/org/plans";
import { FEATURES } from "@/config/features";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  { to: "/bi", label: "Business Intelligence", icon: Bot, enabled: FEATURES.businessIntelligence },
  { to: "/crm", label: "CRM Comercial", icon: Users, enabled: true },
  { to: "/prospeccao", label: "Prospecção", icon: Search, enabled: true },
  { to: "/cadencia", label: "Cadência", icon: Repeat2, enabled: true },
  { to: "/operacoes", label: "Operações", icon: Briefcase, enabled: true },
  { to: "/briefings", label: "Briefings Comerciais", icon: FileText, enabled: true },
  { to: "/catalogo", label: "Catálogo Comercial", icon: Package, enabled: true },
  { to: "/kickoff", label: "Kickoff Produção", icon: Rocket, enabled: true },
  { to: "/propostas", label: "Propostas", icon: FileText, enabled: true },
  { to: "/contratos", label: "Contratos", icon: FileSignature, enabled: true },
  { to: "/indicacoes", label: "Indicações", icon: Share2, enabled: false },
  { to: "/ia", label: "IA Comercial", icon: Bot, enabled: false },
  { to: "/configuracoes", label: "Configurações", icon: Settings, enabled: false },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { plan } = useActiveOrg();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
        const base = "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all";
        const feature = ROUTE_FEATURE[item.to];
        const blockedByPlan = feature ? !planAllows(plan, feature) : false;
        if (!item.enabled || blockedByPlan) {
          const label = blockedByPlan ? "Upgrade" : "Em breve";
          return (
            <button
              key={item.to}
              disabled
              className={`${base} cursor-not-allowed text-muted-foreground/50`}
              title={blockedByPlan ? `Disponível em planos superiores` : "Em breve"}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider opacity-70">{label}</span>
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
  const { plan } = useActiveOrg();
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
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">{PLAN_LABEL[plan]}</p>
            <span className="rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {APP_VERSION_LABEL}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Multi-tenant · IA inclusa · Suporte premium
          </p>
        </div>
      </div>
    </aside>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("infinda:sidebar-collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("infinda:sidebar-collapsed", sidebarCollapsed ? "1" : "0");
  }, [sidebarCollapsed]);

  const handleLogout = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    await navigate({ to: "/login", replace: true });
  };

  const handleLogoutAllDevices = async () => {
    const ok = typeof window !== "undefined"
      ? window.confirm(
          "Isto vai encerrar a sessão em TODOS os dispositivos onde você está logado (incluindo este). Deseja continuar?",
        )
      : true;
    if (!ok) return;

    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Sessão encerrada em todos os dispositivos.");
      await navigate({ to: "/login", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao encerrar sessões.");
    }
  };

  const initials = (user?.name ?? "U")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-background">
      {!sidebarCollapsed && (
        <div className="hidden lg:block">
          <Sidebar />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/80 px-3 py-2.5 backdrop-blur-xl sm:gap-4 sm:px-6 sm:py-3"
          style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0.625rem)" }}
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="tap-target hidden lg:inline-flex"
              aria-label={sidebarCollapsed ? "Abrir menu lateral" : "Recolher menu lateral"}
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="tap-target lg:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <Sidebar onNavigate={() => setMobileMenuOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight sm:text-lg">{title}</h1>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>

          <div className="hidden md:block" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex sm:items-center sm:gap-2">{actions}</div>
            <div className="hidden sm:block">
              <OrgSwitcher />
            </div>
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Conta"
                  className="flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-card px-1.5 py-1 sm:pr-3 transition-colors hover:bg-accent"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--gradient-primary)] text-xs font-bold text-primary-foreground sm:h-7 sm:w-7">
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
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link to="/api-keys" className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Chaves de API
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogoutAllDevices}
                  className="cursor-pointer"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Sair de todos os dispositivos
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {actions && (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-border/60 bg-background/60 px-3 py-2 sm:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {actions}
          </div>
        )}

        <main className="flex-1 px-3 py-4 pb-mobile-nav sm:px-6 sm:py-6 lg:px-8">{children}</main>
      </div>

      <MobileNav onOpenMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
}
