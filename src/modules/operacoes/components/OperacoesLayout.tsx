import type { ReactNode } from "react";
import { OperacoesTabs } from "./OperacoesTabs";

export function OperacoesLayout({
  description,
  children,
}: {
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <OperacoesTabs />
      {description && (
        <p className="-mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
      <div>{children}</div>
    </div>
  );
}