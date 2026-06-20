import { Target, Users, Calendar, BarChart3, Award, Rocket, Shield, Zap } from "lucide-react";
import type { VMBeneficio } from "@/lib/proposta/viewModel";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  target: Target,
  users: Users,
  calendar: Calendar,
  chart: BarChart3,
  award: Award,
  rocket: Rocket,
  shield: Shield,
  zap: Zap,
};

interface Props {
  beneficios: VMBeneficio[];
}

export function BeneficiosSection({ beneficios }: Props) {
  if (beneficios.length === 0) return null;
  return (
    <section className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-primary-glow font-medium">03 · Benefícios</div>
        <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">O que muda no seu negócio</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {beneficios.map((b, i) => {
          const Icon = ICONS[b.icone ?? "target"] ?? Target;
          return (
            <div key={i} className="group rounded-2xl bg-card ring-1 ring-border p-6 hover:ring-primary/40 transition-all hover:-translate-y-0.5">
              <div className="grid place-items-center size-12 rounded-xl bg-primary/15 text-primary-glow ring-1 ring-primary/30">
                <Icon className="size-6" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">{b.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{b.descricao}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}