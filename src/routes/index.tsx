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
        <h1>Auditoria do Mapa (/mapa) — diagnóstico e correções</h1>

        <p>Auditei o carregamento (<code>loadMapPoints</code> em <code>src/lib/tasks-map-api.ts</code>), a página <code>src/routes/mapa.tsx</code> e o render (<code>src/components/TasksMap.tsx</code>). A auditoria é de código: o banco ligado ao editor está vazio (0 prospects/perfis), então não há como confirmar volumes aqui — os números reais são do banco de produção.</p>

        <h2>Problemas encontrados</h2>

        <ol>
          <li><strong>Duplicatas voltam para o mapa.</strong> <code>loadMapPoints</code> lê <code>prospects</code> sem filtrar <code>merged_into is null</code> (a Prospecção filtra). Leads mesclados na deduplicação reaparecem como pinos e inflam contagens, roteiro e "pendentes de enriquecimento".</li>
          <li><strong>Pinos podem desaparecer.</strong> Em <code>TasksMap</code>, cada marcador usa <code>key={p.cnpj}</code>; com CNPJs repetidos o React descarta marcadores irmãos.</li>
          <li><strong>Carregamento muito pesado e sequencial.</strong> Antes de aparecer o primeiro pino o app baixa: todos os <code>prospects</code> (páginas de 1000), todos os <code>company_profiles</code>, e depois endereços e localizações em lotes de 200 ids — dezenas de requisições em série. Os status privados (<code>prospect_touchpoints</code>) somam mais um lote por 200 ids. Em 9k leads isso são muitas viagens ao servidor.</li>
          <li><strong>Falha silenciosa.</strong> A página só trata <code>isLoading</code>; se a consulta falhar, mostra mapa vazio / "0 leads" sem erro nem botão de tentar novamente.</li>
          <li><strong>Cache offline corta dados sem avisar.</strong> O cache guarda apenas os 3000 primeiros pontos; em campo o usuário vê um subconjunto sem saber.</li>
          <li><strong>Leads sem CNPJ nunca aparecem.</strong> O loader exige CNPJ com 14 dígitos, mesmo quando há endereço/coordenada.</li>
          <li><strong>Mapa "pula" durante o uso.</strong> O enriquecimento automático (20 a cada 60s) invalida a query; <code>FitBounds</code> reajusta o enquadramento a cada mudança de pontos, jogando fora o zoom/pan do usuário.</li>
          <li><strong>Enriquecimento duplicado.</strong> O loop automático do navegador roda em paralelo ao cron de servidor (<code>/api/public/hooks/enrich-batch</code>), gastando chamadas de API duas vezes nos mesmos CNPJs.</li>
        </ol>

        <h2>Correções propostas</h2>

        <ul>
          <li>Filtrar <code>merged_into is null</code> no loader do mapa (com o mesmo fallback tolerante já usado na Prospecção quando a coluna não existe) e deduplicar por CNPJ na saída.</li>
          <li>Trocar a key do marcador por um id estável e único (<code>cnpj + índice</code> ou id do prospect).</li>
          <li>Reduzir o carregamento: buscar apenas os perfis/endereços/localizações dos CNPJs que existem em <code>prospects</code>, paralelizar os lotes por id (em vez de série) e manter os status privados em uma única passada; carregar primeiro os pontos com coordenadas e completar o resto em segundo plano.</li>
          <li>Estado de erro na página: mensagem clara + botão "Tentar novamente" (<code>refetch</code>), diferenciando "sem dados" de "falha ao carregar".</li>
          <li>Avisar quando o cache offline truncar (<code>x de y leads disponíveis offline</code>) e elevar o limite.</li>
          <li>Incluir no mapa leads sem CNPJ que já possuam coordenadas.</li>
          <li><code>FitBounds</code> passa a enquadrar só na primeira carga e quando o usuário muda filtro/roteiro — não a cada refresh automático.</li>
          <li>Desligar por padrão o enriquecimento automático do navegador quando o cron do servidor está ativo, deixando o botão de lote manual (20) disponível.</li>
        </ul>

        <h2>Detalhes técnicos</h2>

        <ul>
          <li><code>src/lib/tasks-map-api.ts</code>: filtro <code>merged_into</code>, <code>in("cnpj", …)</code> restrito aos CNPJs dos prospects, <code>Promise.all</code> nos lotes de ids, dedupe final por CNPJ, cache com metadados de truncamento.</li>
          <li><code>src/routes/mapa.tsx</code>: bloco de erro/refetch, <code>useAutoEnrich({ autoStart: false })</code>, chave de enquadramento controlada.</li>
          <li><code>src/components/TasksMap.tsx</code>: key única do <code>Marker</code> e <code>FitBounds</code> com dependência de "fitKey" em vez de <code>points</code>.</li>
          <li>Nenhuma migração de banco necessária.</li>
        </ul>
      </div>
    </div>
  );
}
