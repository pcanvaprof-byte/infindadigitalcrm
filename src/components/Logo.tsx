export function Logo({ size = 32, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid shrink-0 place-items-center rounded-lg bg-white"
        style={{ width: size, height: size }}
      >
        <img
          src="/infinda-logo.png"
          alt="Infinda"
          className="object-contain"
          style={{ width: size * 0.78, height: size * 0.78 }}
        />
      </div>
      {withText && (
        <div className="flex min-w-0 flex-col leading-none">
          <span className="text-sm font-bold tracking-wide">INFINDA</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            CRM · IA · Automação
          </span>
        </div>
      )}
    </div>
  );
}
