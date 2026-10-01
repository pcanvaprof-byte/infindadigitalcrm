import {
  LayoutDashboard,
  Sparkles,
  Search,
  MapPin,
  Repeat2,
  MessageSquareText,
  Users,
  Briefcase,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

import type { OrgRole } from "@/lib/org/plans";

export type TourStep = {
  to: string;
  label: string;
  icon: LucideIcon;
  what: string;
  when: string;
  adminOnly?: boolean;
};

export const TOUR_STEPS: readonly TourStep[] = [
  {
    to: "/meu-negocio",
    label: "Meu Negócio",
    icon: Sparkles,
    what: "O cérebro da IA: nicho, público, tom de voz e a primeira mensagem de prospecção.",
    when: "Comece por aqui — sem isso os disparos não são personalizados.",
  },
  {
    to: "/prospeccao",
    label: "Prospecção",
    icon: Search,
    what: "Sua lista de leads. Filtre, enriqueça dados e dispare o primeiro contato no WhatsApp.",
    when: "Uso diário: é onde a operação começa.",
  },
  {
    to: "/mapa",
    label: "Mapa",
    icon: MapPin,
    what: "Leads no mapa por estado e bairro, com roteiro do dia e check-in de visitas (PAP).",
    when: "Quando a abordagem é presencial, porta a porta.",
  },
  {
    to: "/cadencia",
    label: "Cadência",
    icon: Repeat2,
    what: "Follow-ups organizados por etapa. Mostra quem precisa de contato hoje.",
    when: "Depois do primeiro disparo, para não perder o lead.",
  },
  {
    to: "/meus-templates",
    label: "Meus Templates",
    icon: MessageSquareText,
    what: "Suas mensagens de cada etapa da cadência. Personalize sem afetar os outros usuários.",
    when: "Quando quiser ajustar o texto padrão ao seu jeito.",
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    what: "Comando comercial: seus números do dia, gargalos e ações prioritárias.",
    when: "Abra todo dia de manhã para saber por onde começar.",
  },
  {
    to: "/crm",
    label: "CRM Comercial",
    icon: Users,
    what: "Pipeline de oportunidades: da reunião ao fechamento.",
    when: "Quando o lead responde e vira negociação.",
  },
  {
    to: "/operacoes",
    label: "Operações",
    icon: Briefcase,
    what: "Entrega e acompanhamento dos clientes já fechados.",
    when: "Pós-venda.",
    adminOnly: true,
  },
  {
    to: "/documentacao",
    label: "Documentação",
    icon: BookOpen,
    what: "Guia completo da ferramenta, passo a passo, sempre disponível.",
    when: "Sempre que bater dúvida.",
  },
];

export function tourStepsForRole(role: OrgRole | null): TourStep[] {
  const isAdmin = role === "owner" || role === "admin";
  return TOUR_STEPS.filter((s) => !s.adminOnly || isAdmin);
}
