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
  MessageSquareText,
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

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="ml-5 list-decimal space-y-2 marker:font-semibold marker:text-primary-glow">{children}</ol>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/80">
      💡 <strong>Dica:</strong> {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-foreground/80">
      ⚠️ <strong>Atenção:</strong> {children}
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "primeiros-passos",
    title: "1. Primeiros passos",
    icon: Lightbulb,
    role: "Todos",
    body: (
      <>
        <p>Do primeiro login até estar pronto para operar:</p>
        <Steps>
          <li>
            <strong>Receba as credenciais</strong> — o Owner/Admin envia seu e-mail e uma
            <em> senha temporária</em>. Guarde-a: só é exibida uma vez.
          </li>
          <li>
            <strong>Acesse a plataforma</strong> em <code className="rounded bg-muted px-1">/login</code>{" "}
            e faça login com o e-mail + senha temporária.
          </li>
          <li>
            <strong>Troque a senha</strong> — o sistema redireciona automaticamente para{" "}
            <code className="rounded bg-muted px-1">/alterar-senha</code>. Escolha uma senha forte
            (mínimo 8 caracteres) e confirme.
          </li>
          <li>
            <strong>Confirme o trial</strong> — se você é uma conta nova, verifique o banner no topo
            que mostra os dias restantes (30 dias por padrão).
          </li>
          <li>
            <strong>Configure o <a className="underline" href="#meu-negocio">Meu Negócio</a></strong>{" "}
            antes de qualquer outra ação. Sem isso, a IA responde de forma genérica.
          </li>
          <li>
            <strong>Explore o menu lateral</strong> — os módulos aparecem conforme o seu papel
            (Owner/Admin veem tudo; Member vê só o comercial).
          </li>
        </Steps>
        <Tip>
          Se você é Owner, entre também em <code className="rounded bg-muted px-1">/usuarios</code>{" "}
          e convide seu time antes de operar.
        </Tip>
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
          O <strong>cérebro compartilhado da IA</strong>. Alimenta cadência, enriquecimento e sugestões.
          É <strong>por organização</strong> — todos os membros herdam o mesmo contexto.
        </p>
        <Steps>
          <li>
            Vá em <code className="rounded bg-muted px-1">/meu-negocio</code> pelo menu lateral.
          </li>
          <li>
            No campo <em>Descrição livre</em>, cole um texto (2–3 parágrafos) sobre a sua empresa:
            o que faz, para quem vende, região, diferenciais e principais objeções.
          </li>
          <li>
            Clique em <strong>“Analisar com IA”</strong>. A IA extrai automaticamente:
            proposta de valor, ICP, tom de voz, dores, benefícios, gatilhos e mensagem inicial.
          </li>
          <li>
            Revise cada campo extraído. Ajuste manualmente qualquer coisa que não bateu.
          </li>
          <li>
            Clique em <strong>Salvar</strong>. Ao salvar, aparecerá a opção{" "}
            <em>“Regenerar templates de cadência com o novo contexto”</em>.
          </li>
          <li>
            Aceite se você quer que os textos padrão da organização sejam reescritos com o novo
            posicionamento (isso <strong>não</strong> apaga os overrides pessoais dos members).
          </li>
        </Steps>
        <Warn>
          Revise o Meu Negócio sempre que mudar oferta, público ou tom. É a única forma de a IA
          continuar coerente com a operação.
        </Warn>
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
        <p>Visão consolidada e filtrada automaticamente pelo seu papel.</p>
        <Steps>
          <li>
            <strong>Owner/Admin</strong>: números da organização inteira — total de leads, ativos,
            propostas, MRR e conversões.
          </li>
          <li>
            <strong>Member</strong>: apenas leads e tarefas <em>atribuídos a você</em>. Números de
            colegas nunca aparecem.
          </li>
          <li>
            Clique nos cards para pular direto para a lista filtrada (ex.: “tarefas atrasadas”
            abre <code className="rounded bg-muted px-1">/tarefas</code> já filtrado).
          </li>
          <li>
            Use o filtro de período (topo direito) para comparar semanas ou meses.
          </li>
        </Steps>
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
        <p>Pipeline visual dos clientes ativos e em negociação.</p>
        <Steps>
          <li>
            Abra <code className="rounded bg-muted px-1">/crm</code>. As colunas representam
            estágios: <em>Novo → Contato → Proposta → Negociação → Fechado</em>.
          </li>
          <li>
            <strong>Cadastrar cliente:</strong> clique em <em>“Novo cliente”</em>, preencha
            empresa, contato, telefone e valor estimado. Ou importe direto da Prospecção com o
            botão <em>“Enviar para CRM”</em>.
          </li>
          <li>
            <strong>Mover no funil:</strong> arraste o card entre colunas. O histórico do cliente
            registra o movimento automaticamente.
          </li>
          <li>
            <strong>Ficha do cliente:</strong> clique no card para abrir. Ali você registra
            interações, gera propostas, anexa arquivos e vê o histórico completo.
          </li>
          <li>
            <strong>Fechamento:</strong> quando move para <em>Fechado</em>, o cliente vira ativo
            e entra automaticamente em Operações.
          </li>
        </Steps>
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
          Base de leads <strong>compartilhada</strong> pela organização + cadência{" "}
          <strong>privada</strong> por usuário. Dois members podem trabalhar o mesmo lead sem
          atropelar um ao outro.
        </p>
        <Steps>
          <li>
            Vá em <code className="rounded bg-muted px-1">/prospeccao</code>.
          </li>
          <li>
            <strong>Filtre</strong> por nicho, cidade, estado ou status (não contatado, em cadência,
            respondido, etc.).
          </li>
          <li>
            <strong>Importe leads</strong> via CSV (botão <em>“Importar”</em>) ou cadastre um por vez.
          </li>
          <li>
            Selecione um lead e clique em <strong>“Enriquecer”</strong> — a IA busca CNPJ,
            endereço completo, sócios, faixa de faturamento e calcula um score.
          </li>
          <li>
            Clique em <strong>“Enviar para Cadência”</strong>. O lead entra no seu funil pessoal em{" "}
            <code className="rounded bg-muted px-1">/cadencia</code>.
          </li>
        </Steps>
        <Tip>
          Enriqueça em lotes de 10–20 leads antes de disparar cadência — a taxa de resposta
          melhora quando você personaliza pela cidade/faturamento.
        </Tip>
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
          Sequência automatizada de 7 toques (Follow-up 1 → 7). Cada usuário tem seu funil
          privado — Members nunca veem cadência de outros.
        </p>
        <Steps>
          <li>
            Abra <code className="rounded bg-muted px-1">/cadencia</code>. As colunas são os
            estágios (Follow-up 1 a 7 + Interessado, Reunião, Proposta, Negociação, Fechado, Perdido).
          </li>
          <li>
            Clique num card e depois em <strong>“Enviar mensagem”</strong>. O sistema abre um
            editor com o texto do template resolvido para o estágio.
          </li>
          <li>
            <strong>Prioridade do template</strong>: (1) seu override em{" "}
            <a href="#meus-templates" className="underline">Meus Templates</a> → (2) padrão da
            organização → (3) padrão do sistema. Você sempre pode ajustar antes de enviar.
          </li>
          <li>
            Marque a mensagem como enviada. O lead avança automaticamente para o próximo estágio
            e agenda o próximo toque conforme o intervalo (3, 7, 10, 14, 18, 24 e 30 dias).
          </li>
          <li>
            Se o lead <strong>responder</strong>, registre com o botão <em>“Registrar resposta”</em>{" "}
            — a cadência pausa e o card muda para <em>Interessado</em>.
          </li>
          <li>
            <strong>Notificações</strong> no sino (topo) avisam quando um toque está atrasado ou
            uma resposta pendente aguarda retorno.
          </li>
        </Steps>
        <Warn>
          Nunca dois usuários enviam pelo mesmo lead ao mesmo tempo — a cadência é privada, mas o
          lead é compartilhado. Combinem responsabilidade no CRM.
        </Warn>
      </>
    ),
  },
  {
    id: "meus-templates",
    title: "7. Meus Templates (por usuário)",
    icon: MessageSquareText,
    role: "Todos",
    body: (
      <>
        <p>
          Cada member pode ter <strong>sua própria versão</strong> de qualquer template de cadência,
          sem afetar os colegas nem o padrão da organização.
        </p>
        <Steps>
          <li>
            Vá em <code className="rounded bg-muted px-1">/meus-templates</code>. Você verá os 7
            estágios de follow-up com o texto atualmente em uso.
          </li>
          <li>
            O badge indica a origem:{" "}
            <Badge variant="secondary" className="mx-1">Padrão da Organização</Badge> significa que
            está usando o texto do Owner/Admin;{" "}
            <Badge className="mx-1">Meu Template</Badge> significa que você já personalizou.
          </li>
          <li>
            Clique em <strong>“Personalizar”</strong> para criar seu override. O editor abre com o
            texto atual como ponto de partida.
          </li>
          <li>
            Edite título e mensagem. Use as variáveis <code>{"{{responsavel}}"}</code>,{" "}
            <code>{"{{empresa}}"}</code>, <code>{"{{empresa_curta}}"}</code>,{" "}
            <code>{"{{nome}}"}</code>. O <em>preview</em> abaixo mostra exatamente o que será
            enviado (mesmo parser do motor).
          </li>
          <li>
            Clique em <strong>Salvar</strong>. A cadência passa a usar o seu texto imediatamente.
          </li>
          <li>
            Se quiser voltar ao padrão da organização, clique em{" "}
            <strong>“Restaurar padrão”</strong> — apenas apaga o seu override, sem afetar ninguém.
          </li>
        </Steps>
        <Tip>
          O Owner/Admin edita o padrão da organização em{" "}
          <code className="rounded bg-muted px-1">/cadencia</code> (aba Templates). Members não
          conseguem alterar o padrão, apenas criar overrides pessoais.
        </Tip>
      </>
    ),
  },
  {
    id: "tarefas",
    title: "8. Tarefas do dia",
    icon: FileText,
    role: "Todos",
    body: (
      <>
        <p>Lista consolidada de tudo que precisa ser feito hoje.</p>
        <Steps>
          <li>
            Abra <code className="rounded bg-muted px-1">/tarefas</code> logo cedo.
          </li>
          <li>
            A tela mistura <em>toques de cadência agendados</em> + <em>follow-ups manuais</em> +{" "}
            <em>propostas aguardando resposta</em>.
          </li>
          <li>
            Clique em cada tarefa para abrir o lead/cliente no contexto correto.
          </li>
          <li>
            Marque como <strong>Concluída</strong> ao terminar — a cadência avança e o dashboard
            atualiza os KPIs.
          </li>
          <li>
            Use <strong>“Adiar”</strong> para reagendar (evita empilhar tarefa vencida).
          </li>
        </Steps>
      </>
    ),
  },
  {
    id: "operacoes",
    title: "9. Operações & Kickoff",
    icon: Briefcase,
    role: "Owner/Admin",
    body: (
      <>
        <p>Área pós-venda dos clientes ativos. Restrito a Owner e Admin.</p>
        <Steps>
          <li>
            Quando um cliente vira <em>Fechado</em> no CRM, ele aparece automaticamente em{" "}
            <code className="rounded bg-muted px-1">/operacoes</code>.
          </li>
          <li>
            Faça o <strong>Kickoff</strong>: preencha checklist de onboarding, contatos, acessos
            e prazos.
          </li>
          <li>
            Acompanhe <strong>Implantação</strong> (tráfego pago, sites, integrações) com status
            visual.
          </li>
          <li>
            Registre <strong>renovações</strong> e <strong>eventos financeiros</strong> (pagamentos,
            atrasos, upgrades).
          </li>
          <li>
            Use a aba de <strong>histórico</strong> para revisar tudo que foi feito pelo cliente.
          </li>
        </Steps>
      </>
    ),
  },
  {
    id: "propostas-contratos",
    title: "10. Propostas, Contratos e Catálogo",
    icon: Package,
    role: "Owner/Admin",
    body: (
      <>
        <p>Fluxo comercial completo, do orçamento ao contrato assinado.</p>
        <Steps>
          <li>
            <strong>Catálogo</strong> (<code className="rounded bg-muted px-1">/catalogo</code>):
            cadastre produtos e serviços com nome, descrição, valor e categoria. Eles ficam
            disponíveis em todas as propostas.
          </li>
          <li>
            <strong>Nova proposta</strong>: dentro do CRM, na ficha do cliente, clique em{" "}
            <em>“Gerar proposta”</em>. Adicione itens do catálogo, ajuste valores, prazo e condições.
          </li>
          <li>
            Clique em <strong>“Gerar link público”</strong>. O sistema cria uma URL não indexada
            que você envia ao cliente por WhatsApp/e-mail.
          </li>
          <li>
            O cliente abre o link, revê a proposta e <strong>aceita</strong>, <strong>rejeita</strong>{" "}
            ou <strong>pede ajustes</strong>. Você recebe notificação.
          </li>
          <li>
            Se aceita, clique em <strong>“Gerar contrato”</strong> — a proposta vira contrato,
            também com link público para assinatura.
          </li>
          <li>
            Contratos assinados movem o cliente para <em>Ativo</em> automaticamente.
          </li>
        </Steps>
      </>
    ),
  },
  {
    id: "usuarios",
    title: "11. Usuários & Papéis",
    icon: UserCog,
    role: "Owner/Admin",
    body: (
      <>
        <p>Convide e gerencie a equipe da sua organização.</p>
        <Steps>
          <li>
            Vá em <code className="rounded bg-muted px-1">/usuarios</code>.
          </li>
          <li>
            Clique em <strong>“Novo usuário”</strong>. Preencha nome, e-mail e escolha o papel:
            <ul className="ml-5 mt-1 list-disc space-y-0.5">
              <li><strong>Owner</strong> — dono da organização, controla faturamento e usuários.</li>
              <li><strong>Admin</strong> — acesso total exceto faturamento.</li>
              <li><strong>Member</strong> — só módulos comerciais e apenas os próprios dados.</li>
            </ul>
          </li>
          <li>
            O sistema gera uma <strong>senha temporária</strong> — copie e envie ao usuário por um
            canal seguro (não fica gravada em lugar nenhum depois de fechar o modal).
          </li>
          <li>
            Para <strong>resetar senha</strong> de alguém que esqueceu, use o botão{" "}
            <em>“Gerar nova senha temporária”</em> na lista.
          </li>
          <li>
            <strong>Trial de 30 dias</strong>: novos users começam em trial. Owners podem estender
            ou ativar assinatura em <code className="rounded bg-muted px-1">/assinatura</code>.
          </li>
        </Steps>
      </>
    ),
  },
  {
    id: "api",
    title: "12. API Pública",
    icon: KeyRound,
    role: "Owner/Admin",
    body: (
      <>
        <p>
          Integre agentes de IA externos (Claude, GPT, n8n, etc.) via REST em{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/public/v1/*</code>.
        </p>
        <Steps>
          <li>
            Abra <code className="rounded bg-muted px-1">/api-keys</code>.
          </li>
          <li>
            Clique em <strong>“Gerar nova chave”</strong>, dê um nome (ex.: “Claude Agent”).
          </li>
          <li>
            <strong>Copie a chave imediatamente</strong> — só é exibida uma vez. O sistema guarda
            apenas o hash.
          </li>
          <li>
            No agente externo, envie em cada request o header:{" "}
            <code className="rounded bg-muted px-1">Authorization: Bearer &lt;sua-chave&gt;</code>.
          </li>
          <li>
            Endpoints principais:
            <ul className="ml-5 mt-1 list-disc space-y-0.5 text-xs">
              <li><code>GET /v1/me</code> — dados da organização.</li>
              <li><code>GET /v1/clients</code> · <code>POST /v1/clients</code> · <code>PATCH /v1/clients/:id</code></li>
              <li><code>GET /v1/tasks</code> · <code>POST /v1/tasks</code></li>
              <li><code>POST /v1/interactions</code></li>
              <li><code>POST /v1/proposals</code></li>
            </ul>
          </li>
          <li>
            Consulte o <strong>OpenAPI</strong> em <code>/api/public/v1/openapi.json</code>.
          </li>
          <li>
            <strong>Revogue</strong> qualquer chave comprometida imediatamente pelo botão{" "}
            <em>Revogar</em>.
          </li>
        </Steps>
        <Warn>
          A chave dá acesso total aos dados da organização. Nunca comite no Git, use variáveis de
          ambiente ou secrets manager.
        </Warn>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "13. Segurança & Isolamento",
    icon: ShieldCheck,
    role: "Todos",
    body: (
      <>
        <p>Camadas de proteção ativas por padrão:</p>
        <Steps>
          <li>
            <strong>Isolamento por organização</strong>: RLS no banco garante que dados de uma org
            nunca vazem para outra.
          </li>
          <li>
            <strong>Isolamento por usuário (Members)</strong>: cadência, tarefas e histórico são
            privados. Members só veem os próprios registros.
          </li>
          <li>
            <strong>Chaves de API</strong>: armazenadas com hash SHA-256. O texto plano existe
            apenas na sua tela no momento da geração.
          </li>
          <li>
            <strong>Encerrar sessão global</strong>: no seu perfil (avatar → “Sair de todos os
            dispositivos”), invalida todos os tokens ativos em qualquer computador/celular.
          </li>
          <li>
            <strong>Senha obrigatória forte</strong>: mínimo 8 caracteres. Troca obrigatória no
            primeiro login e após reset.
          </li>
          <li>
            <strong>Auditoria</strong>: uso de chaves e alterações críticas ficam registradas.
          </li>
        </Steps>
      </>
    ),
  },
  {
    id: "ia",
    title: "14. Onde a IA atua",
    icon: Bot,
    role: "Todos",
    body: (
      <>
        <p>Onde a IA opera hoje e quais modelos usa:</p>
        <Steps>
          <li>
            <strong>Perfil do negócio</strong> (Meu Negócio) — extrai proposta, ICP, tom, dores e
            benefícios a partir de texto livre.
          </li>
          <li>
            <strong>Templates de cadência</strong> — gera e regenera as 7 mensagens de follow-up
            alinhadas ao Meu Negócio.
          </li>
          <li>
            <strong>Adaptação de mensagem</strong> — no envio, ajusta variações do texto pelo
            perfil do lead.
          </li>
          <li>
            <strong>Enriquecimento de leads</strong> — CNPJ, endereço, sócios, faixa de faturamento
            e score automático na Prospecção.
          </li>
          <li>
            <strong>Sugestões de próximo passo</strong> — em tarefas e follow-ups, com base no
            histórico do lead.
          </li>
        </Steps>
        <Tip>
          A IA opera com <strong>tripla redundância</strong> (Groq principal → Groq backup →
          Lovable AI Gateway). Se um provedor cair, outro assume automaticamente — você não perde
          nenhuma operação.
        </Tip>
      </>
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
