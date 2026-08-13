import { createFileRoute, Navigate } from "@tanstack/react-router";
// Preciso aquecer os 9k de leads de forma automatica
// quando configurar o lead para de aparecer os primeiros passos

import { SalesPage } from "@/components/SalesPage";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "INFINDA — O sistema operacional comercial da sua empresa" },
      {
        name: "description",
        content:
          "CRM, prospecção, metas, propostas e IA em uma única plataforma. Construído para equipes que vendem todo dia.",
      },
      { property: "og:title", content: "INFINDA — CRM · IA · Automação" },
      {
        property: "og:description",
        content:
          "A plataforma comercial completa: CRM, prospecção inteligente, metas, propostas e IA para times de vendas.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { user, isReady } = useAuth();
  if (isReady && user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="flex flex-col">
      <SalesPage />
      <div className="mx-auto max-w-4xl p-8 prose prose-invert">
        <h1>Correção: leads "Não contatado" que aparecem bloqueados para disparo</h1>

        <h2>O que a auditoria encontrou (perfil Juliana Rufatto Ferreira)</h2>

        <p>Dados reais do banco de produção:</p>

        <ul>
          <li>138 prospects receberam disparo de WhatsApp registrado pela Juliana.</li>
          <li>130 desses continuam com <code>status = nao_contatado</code> na tabela compartilhada <code>prospects</code> (só 7 estão em <code>primeiro_contato</code>, 1 perdido).</li>
          <li>126 dos 138 têm o registro privado de status (<code>touchpoint</code> tipo <code>status</code>); 14 disparos ficaram sem esse registro.</li>
          <li>Ela tem 135 leads na cadência, 134 todos parados em <code>followup_1</code> com data de próxima ação já vencida.</li>
        </ul>

        <h2>Causa raiz confirmada</h2>

        <p>A trava de 24h (<code>src/lib/dispatch-lock.ts</code>) consulta <code>prospect_touchpoints</code> <strong>filtrando apenas pelo prospect</strong>, sem filtrar pelo usuário. Como os prospects são compartilhados na organização, um disparo feito por outro usuário bloqueia a Juliana — e, como o status exibido é privado por usuário, o mesmo lead aparece para ela como "Não contatado". Resultado: lead visualmente disponível, mas impossível de disparar, sem explicação.</p>

        <p>Um segundo problema, menor: quando o registro privado de status falha (14 casos), o lead só é reclassificado em memória, então a lista pode oscilar entre "Não contatado" e "Primeiro contato" entre recarregamentos.</p>

        <h2>O que será feito</h2>

        <ol>
          <li><strong>Trava por usuário</strong>: a checagem de disparo nas últimas 24h passa a considerar somente os disparos do próprio usuário (touchpoints com o <code>user_id</code> da sessão e mensagens de cadência do próprio owner). Assim ninguém é bloqueado pelo trabalho de outro membro.</li>
          <li><strong>Status nunca mais "Não contatado" para quem já disparou</strong>: o leitor de estado privado passa a marcar <code>primeiro_contato</code> sempre que existir qualquer disparo do usuário, mesmo sem o registro de status, e o registro que faltou é gravado de forma idempotente na próxima leitura de disparo (corrige os 14 casos da Juliana e casos futuros).</li>
        </ol>
      </div>
    </div>
  );
}
