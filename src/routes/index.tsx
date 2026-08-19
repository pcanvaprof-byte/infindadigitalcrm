import { createFileRoute, Navigate } from "@tanstack/react-router";
// Preciso aquecer os 9k de leads de forma automatica
// E os leads ja disparados nesse perfil que tiver qualquer alteração no card mudar para status principalmente os que ja tiveram qualquer clique

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
        <h1>Auditoria: leads já disparados que voltam para a fila de prospecção</h1>

        <h2>O que a auditoria encontrou (base de produção, todos os perfis)</h2>

        <p>4 perfis com atividade real, 13.064 prospects na organização:</p>

        <div className="overflow-x-auto my-6">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2">Perfil (id abreviado)</th>
                <th className="text-left py-2">Disparos</th>
                <th className="text-left py-2">Registros de status</th>
                <th className="text-left py-2">Leads disparados com <strong>duplicata</strong> ainda na fila</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2">e3c71f7e…</td>
                <td className="py-2">840</td>
                <td className="py-2">1.278</td>
                <td className="py-2"><strong>260</strong></td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2">f8ff286c…</td>
                <td className="py-2">139</td>
                <td className="py-2">202</td>
                <td className="py-2"><strong>42</strong></td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2">95d2bcef… (Juliana)</td>
                <td className="py-2">176</td>
                <td className="py-2">312</td>
                <td className="py-2"><strong>45</strong></td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2">18ca99db…</td>
                <td className="py-2">36</td>
                <td className="py-2">70</td>
                <td className="py-2"><strong>3</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Falha 1 — duplicatas de cadastro (causa principal, confirmada)</h3>

        <p>A tabela <code>prospects</code> tem <strong>1.716 CNPJs repetidos (2.066 linhas extras)</strong> e 1.714 nomes de empresa repetidos. O status de contato é privado <strong>por linha de prospect</strong>, não por empresa. Então, quando o operador dispara na linha A, a linha B da mesma empresa continua como "Não contatado" e reaparece na fila — é exatamente o "cliente disparado que está retornando". Isso atinge ~1 em cada 3 leads disparados do perfil mais ativo.</p>

        <p>Além disso, a trava de 24h é por <code>prospect_id</code>, então a duplicata <strong>não é travada</strong>: o operador dispara de novo no mesmo WhatsApp e queima o lead.</p>

        <h3>Falha 2 — status "Perdido"/"Cliente" perdidos na leitura</h3>

        <p>Dos 1.858 registros de status, <strong>1.374 foram gravados com texto humano</strong> (<code>Status alterado para "Perdido"</code>, <code>"Fechado / Ganho"</code>, <code>"Qualificado"</code>…) e só 484 no formato canônico <code>status:{"<"}chave{">"}</code>. O leitor só reconhece o formato canônico, então 100 leads marcados como <strong>Perdido</strong> e outros marcados como Qualificado/Fechado voltam a ser lidos como "Primeiro contato". Simulação sobre a base real: 1.090 pares usuário/lead com disparo, 0 caem em "Não contatado" (a trava atual funciona), mas os desfechos manuais são apagados na leitura.</p>

        <h3>Falha 3 — leitura de estado privado falha em silêncio</h3>

        <p><code>loadPrivateStatesFromTouchpoints</code> percorre 13k prospects em ~66 lotes sequenciais e, em qualquer erro de rede, faz <code>return out</code> com o mapa <strong>parcial</strong>. Todo lead não coberto volta a aparecer como "Não contatado" naquele carregamento — sintoma intermitente de "voltou tudo pra fila".</p>

        <h2>O que será feito</h2>

        <ol>
          <li><strong>Identidade única de empresa (corrige o retorno)</strong>
            <ul>
              <li>Migração de deduplicação em <code>prospects</code>: para cada grupo com o mesmo CNPJ (raiz de 8 dígitos quando não há 14) ou mesmo nome+cidade, manter a linha mais antiga como canônica, repontar <code>prospect_touchpoints</code>, <code>cad_leads</code> e dados de enriquecimento para ela e marcar as extras como arquivadas (nova coluna <code>merged_into uuid</code> — nada é apagado, dá para reverter).</li>
              <li>Índice único parcial por organização sobre o CNPJ normalizado para impedir novas duplicatas na importação.</li>
              <li>Importação passa a casar por CNPJ normalizado (raiz inclusive), não só pela string crua.</li>
            </ul>
          </li>
          <li><strong>Trava e ocultação por empresa, não por linha</strong>: a trava de 24h e o filtro "ocultar leads já disparados por mim" passam a usar a chave de identidade (CNPJ normalizado → WhatsApp normalizado → nome+cidade). Mesmo que sobre alguma duplicata, ela some da fila e fica travada junto com a original.</li>
          <li><strong>Status humano é reconhecido e normalizado</strong>: o leitor passa a mapear os rótulos em português (<code>Perdido</code>, <code>Fechado / Ganho</code>, <code>Qualificado</code>, <code>Agendado</code>, <code>Em andamento</code>…) para as chaves internas, com precedência para o registro <strong>mais recente</strong>; toda gravação nova usa somente <code>status:{"<"}chave{">"}</code>. Backfill idempotente reescreve os 1.374 registros antigos no formato canônico.</li>
          <li><strong>Leitura de estado privado sem falha silenciosa</strong>: lotes em paralelo com retry; se algum lote falhar de vez, a tela avisa "não foi possível carregar seu histórico" em vez de mostrar os leads como não contatados.</li>
          <li><strong>Relatório de auditoria por perfil</strong> em <code>/usuarios</code> (Owner/Admin): por membro, disparos, leads em cadência, duplicatas ainda pendentes e último disparo — para conferir depois da correção.</li>
        </ol>

        <h2>Detalhes técnicos</h2>

        <ul>
          <li><code>scripts/migrations/2026xxxx_prospects_dedupe_identity.sql</code>: coluna <code>merged_into</code>, função de normalização de CNPJ, merge idempotente com repontamento de FKs, índice único parcial <code>(organization_id, cnpj_norm) where merged_into is null</code>, mais GRANTs preservados.</li>
          <li><code>src/lib/prospect-identity.ts</code> (novo): <code>identityKey(prospect)</code> compartilhado por prospecção, mapa e trava.</li>
          <li><code>src/lib/dispatch-lock.ts</code>: resolve os <code>prospect_id</code> irmãos da mesma identidade antes de checar as últimas 24h.</li>
          <li><code>src/lib/prospects-api.ts</code>: <code>normalizePrivateStatus</code> aceita rótulos humanos; leitura com precedência do evento mais recente; loader paralelo com retry e erro propagado; filtro <code>merged_into is null</code> na listagem.</li>
          <li><code>src/routes/prospeccao.tsx</code>: <code>hideDispatched</code> e a ordenação de bloqueio usam a identidade da empresa.</li>
          <li>Sem alteração no modelo de permissões: prospects seguem compartilhados por organização e o histórico segue privado por usuário.</li>
        </ul>
      </div>
    </div>
  );
}
