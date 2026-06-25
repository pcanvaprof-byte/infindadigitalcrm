import type { ReactNode } from "react";
import { OperacoesTabs } from "./OperacoesTabs";

export function OperacoesLayout({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <OperacoesTabs />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-glow">
            Operações
          </div>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div>{children}</div>
    </div>
  );
}