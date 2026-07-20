import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen,
  LayoutDashboard,
  Sparkles,
  Users,
  Search,
  Repeat2,
  Briefcase,
  FileText,
  Package,
  Rocket,
  FileSignature,
  UserCog,
  KeyRound,
  ShieldCheck,
  Bot,
  Lightbulb,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/documentacao")({
  head: () => ({
    meta: [
      { title: "Documentação — INFINDA" },
      { name: "description", content: "Guia completo de como usar a plataforma INFINDA: módulos, papéis, cadência, IA e boas práticas." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <DocsPage />
    </RequireAuth>
  ),
});

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  role?: "Todos" | "Owner/Admin" | "Member";
  body: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "primeiros-passos",
    title: "1. Primeiros passos",
    icon: Lightbulb,
    role: "Todos",
    body: (
      <>
        <p>
          Ao entrar pela primeira vez, o sistema pede a <strong>troca da senha temporária</strong>.
          Depois disso, você é direcionado para o Dashboard.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Configure o <strong>Meu Negócio</strong> antes de operar — ele alimenta toda a IA da plataforma.</li>
          <li>Verifique o banner de trial no topo (quando aplicável) para saber quantos dias restam.</li>
          <li>Use o menu lateral para navegar entre os módulos.</li>
        </ul>
      </>
    ),
  },
  {
    id: "meu-negocio",
    title: "2. Meu Negócio (contexto da IA)",
    icon: Sparkles,
    role: "Todos",
    body: (
      <>
        <p>
          Este é o <strong>cérebro da IA</strong>. Descreva sua empresa em texto livre e a IA extrai:
          proposta de valor, público-alvo, tom de voz, diferenciais e objeções comuns.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>É <strong>compartilhado por organização</strong> — todos os usuários operam com o mesmo contexto.</li>
          <li>Ao salvar, você pode <strong>regenerar os templates de cadência</strong> para refletir o novo posicionamento.</li>
          <li>Reveja sempre que mudar oferta, ICP ou tom de comunicação.</li>
        </ul>
      </>
    ),
  },
  {
    id: "dashboard",
    title: "3. Dashboard",
    icon: LayoutDashboard,
    role: "Todos",
    body: (
      <>
        <p>Visão consolidada da operação. Os números são <strong>filtrados por papel</strong>:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Owner/Admin</strong>: vê métricas de toda a organização.</li>
          <li><strong>Member</strong>: vê apenas leads e tarefas atribuídos a ele.</li>
        </ul>
      </>
    ),
  },
  {
    id: "crm",
    title: "4. CRM Comercial",
    icon: Users,
    role: "Todos",
    body: (
      <>
        <p>Pipeline visual dos clientes por status. Arraste cards entre colunas para mover no funil.</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Cadastre clientes manualmente ou importe da Prospecção.</li>
          <li>Registre interações e propostas diretamente na ficha do cliente.</li>
        </ul>
      </>
    ),
  },
  {
    id: "prospeccao",
    title: "5. Prospecção",
    icon: Search,
    role: "Todos",
    body: (
      <>
        <p>
          Base de <strong>leads compartilhada</strong> pela organização (todos veem os mesmos leads),
          mas o <strong>trabalho é privado por usuário</strong> — cada um gerencia sua cadência sem
          interferir na do outro.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Filtre por nicho, região e status.</li>
          <li>Enriqueça dados da empresa com IA (CNPJ, endereço, sócios, score).</li>
          <li>Envie para a Cadência com um clique.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cadencia",
    title: "6. Cadência",
    icon: Repeat2,
    role: "Todos",
    body: (
      <>
        <p>
          Sequência de contatos automatizada por lead. As mensagens são <strong>adaptadas pela IA</strong>{" "}
          com base no Meu Negócio.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Cada usuário tem sua própria cadência — dados isolados por <em>owner</em>.</li>
          <li>Notificações no sino avisam quando é hora do próximo toque.</li>
          <li>Registre respostas para pausar/avançar automaticamente.</li>
        </ul>
      </>
    ),
  },
  {
    id: "tarefas",
    title: "7. Tarefas do dia",
    icon: FileText,
    role: "Todos",
    body: (
      <p>Lista todas as ações pendentes do dia (cadência + follow-ups manuais). Marque como feito para avançar.</p>
    ),
  },
  {
    id: "operacoes",
    title: "8. Operações & Kickoff",
    icon: Briefcase,
    role: "Owner/Admin",
    body: (
      <>
        <p>Área pós-venda: onboarding, implantação, financeiro, renovações e histórico de clientes ativos.</p>
        <p className="text-sm text-muted-foreground">Restrito a Owner e Admin.</p>
      </>
    ),
  },
  {
    id: "propostas-contratos",
    title: "9. Propostas, Contratos e Catálogo",
    icon: Package,
    role: "Owner/Admin",
    body: (
      <ul className="ml-5 list-disc space-y-1">
        <li><strong>Catálogo</strong>: cadastre produtos/serviços reutilizáveis nas propostas.</li>
        <li><strong>Propostas</strong>: gere link público para o cliente aceitar online.</li>
        <li><strong>Contratos</strong>: transforme propostas aceitas em contratos assinados.</li>
      </ul>
    ),
  },
  {
    id: "usuarios",
    title: "10. Usuários & Papéis",
    icon: UserCog,
    role: "Owner/Admin",
    body: (
      <>
        <p>Convide membros da equipe e gere senhas temporárias. Três papéis:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Owner</strong>: acesso total, dono da organização e do plano.</li>
          <li><strong>Admin</strong>: acesso total exceto faturamento.</li>
          <li><strong>Member</strong>: acesso restrito aos módulos comerciais e apenas aos próprios dados.</li>
        </ul>
      </>
    ),
  },
  {
    id: "api",
    title: "11. API Pública",
    icon: KeyRound,
    role: "Owner/Admin",
    body: (
      <>
        <p>
          Integre agentes de IA externos (Claude, GPT, n8n, etc.) via REST em{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/public/v1/*</code>.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Gere uma chave em <strong>API Keys</strong> — só é exibida uma vez.</li>
          <li>Envie no header <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer &lt;chave&gt;</code>.</li>
          <li>Endpoints: clientes, tarefas, interações, propostas e <code>/me</code>.</li>
        </ul>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "12. Segurança & Isolamento",
    icon: ShieldCheck,
    role: "Todos",
    body: (
      <ul className="ml-5 list-disc space-y-1">
        <li>Dados isolados por organização via RLS no banco.</li>
        <li>Members só enxergam registros próprios; Owner/Admin veem tudo da organização.</li>
        <li>Chaves de API são armazenadas com hash — nunca em texto plano.</li>
        <li>Sessão pode ser encerrada em todos os dispositivos pelo perfil.</li>
      </ul>
    ),
  },
  {
    id: "ia",
    title: "13. Onde a IA atua",
    icon: Bot,
    role: "Todos",
    body: (
      <ul className="ml-5 list-disc space-y-1">
        <li>Extração do perfil do negócio a partir de texto livre.</li>
        <li>Geração e adaptação de mensagens da cadência.</li>
        <li>Enriquecimento de leads na Prospecção.</li>
        <li>Sugestões de próximo passo em tarefas e follow-ups.</li>
      </ul>
    ),
  },
];

function DocsPage() {
  return (
    <AppShell
      title="Documentação"
      subtitle="Guia rápido de como usar a plataforma INFINDA"
    >
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <Card className="sticky top-4 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-primary-glow" />
              Sumário
            </div>
            <nav className="flex flex-col gap-1">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <BookOpen className="h-6 w-6 text-primary-glow" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Bem-vindo à INFINDA</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Plataforma comercial multi-tenant com IA inclusa. Este guia cobre os módulos principais,
                  papéis de acesso e as boas práticas para vender mais em menos tempo.
                </p>
              </div>
            </div>
          </Card>

          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.id} id={s.id} className="scroll-mt-24 p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-accent/40 p-2">
                      <Icon className="h-5 w-5 text-primary-glow" />
                    </div>
                    <h3 className="text-base font-semibold">{s.title}</h3>
                  </div>
                  {s.role && (
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                      {s.role}
                    </Badge>
                  )}
                </div>
                <Separator className="mb-4" />
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </div>
              </Card>
            );
          })}

          <Card className="p-6">
            <h3 className="text-base font-semibold">Precisa de ajuda?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Fale com o administrador da sua organização ou com o suporte INFINDA.
              Owners podem gerenciar assinatura em <strong>/assinatura</strong>.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
