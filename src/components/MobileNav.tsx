import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Search,
  ListChecks,
  Menu as MenuIcon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type Item = {
  to?: string;
  label: string;
  icon: IconType;
  match?: (path: string) => boolean;
  action?: () => void;
};

export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items: Item[] = [
    { to: "/dashboard", label: "Início", icon: LayoutDashboard },
    { to: "/crm", label: "CRM", icon: Users },
    { to: "/prospeccao", label: "Prospec.", icon: Search },
    { to: "/briefings", label: "Briefings", icon: ListChecks },
    { label: "Mais", icon: MenuIcon, action: onOpenMenu },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 4px)" }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.to
            ? item.match
              ? item.match(pathname)
              : pathname === item.to || pathname.startsWith(item.to + "/")
            : false;

          const inner = (
            <span
              className={`relative mx-auto flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[var(--gradient-primary)]"
                />
              )}
              <Icon
                className={`h-5 w-5 ${isActive ? "text-primary-glow" : ""}`}
              />
              <span className="truncate leading-none">{item.label}</span>
            </span>
          );

          return (
            <li key={item.label} className="flex">
              {item.to ? (
                <Link
                  to={item.to}
                  className="flex min-h-[56px] w-full items-stretch outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={item.action}
                  className="flex min-h-[56px] w-full items-stretch outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={item.label}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}