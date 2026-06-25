import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PlaceholderTab({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <Card className="p-8">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary-glow" />
        Em construção
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
      <ul className="mt-4 grid gap-2 text-sm text-foreground/80 sm:grid-cols-2">
        {bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/30 p-3"
          >
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary-glow" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}