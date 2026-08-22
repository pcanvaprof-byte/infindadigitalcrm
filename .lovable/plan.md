# Auditoria do Mapa (/mapa) — diagnóstico e correções

Auditei o carregamento (`loadMapPoints` em `src/lib/tasks-map-api.ts`), a página `src/routes/mapa.tsx` e o render (`src/components/TasksMap.tsx`). A auditoria é de código: o banco ligado ao editor está vazio (0 prospects/perfis), então não há como confirmar volumes aqui — os números reais são do banco de produção.

## Problemas encontrados

1. **Duplicatas voltam para o mapa.** `loadMapPoints` lê `prospects` sem filtrar `merged_into is null` (a Prospecção filtra). Leads mesclados na deduplicação reaparecem como pinos e inflam contagens, roteiro e "pendentes de enriquecimento".
2. **Pinos podem desaparecer.** Em `TasksMap`, cada marcador usa `key={p.cnpj}`; com CNPJs repetidos o React descarta marcadores irmãos.
3. **Carregamento muito pesado e sequencial.** Antes de aparecer o primeiro pino o app baixa: todos os `prospects` (páginas de 1000), todos os `company_profiles`, e depois endereços e localizações em lotes de 200 ids — dezenas de requisições em série. Os status privados (`prospect_touchpoints`) somam mais um lote por 200 ids. Em 9k leads isso são muitas viagens ao servidor.
4. **Falha silenciosa.** A página só trata `isLoading`; se a consulta falhar, mostra mapa vazio / "0 leads" sem erro nem botão de tentar novamente.
5. **Cache offline corta dados sem avisar.** O cache guarda apenas os 3000 primeiros pontos; em campo o usuário vê um subconjunto sem saber.
6. **Leads sem CNPJ nunca aparecem.** O loader exige CNPJ com 14 dígitos, mesmo quando há endereço/coordenada.
7. **Mapa "pula" durante o uso.** O enriquecimento automático (20 a cada 60s) invalida a query; `FitBounds` reajusta o enquadramento a cada mudança de pontos, jogando fora o zoom/pan do usuário.
8. **Enriquecimento duplicado.** O loop automático do navegador roda em paralelo ao cron de servidor (`/api/public/hooks/enrich-batch`), gastando chamadas de API duas vezes nos mesmos CNPJs.

## Correções propostas

- Filtrar `merged_into is null` no loader do mapa (com o mesmo fallback tolerante já usado na Prospecção quando a coluna não existe) e deduplicar por CNPJ na saída.
- Trocar a key do marcador por um id estável e único (`cnpj + índice` ou id do prospect).
- Reduzir o carregamento: buscar apenas os perfis/endereços/localizações dos CNPJs que existem em `prospects`, paralelizar os lotes por id (em vez de série) e manter os status privados em uma única passada; carregar primeiro os pontos com coordenadas e completar o resto em segundo plano.
- Estado de erro na página: mensagem clara + botão "Tentar novamente" (`refetch`), diferenciando "sem dados" de "falha ao carregar".
- Avisar quando o cache offline truncar (`x de y leads disponíveis offline`) e elevar o limite.
- Incluir no mapa leads sem CNPJ que já possuam coordenadas.
- `FitBounds` passa a enquadrar só na primeira carga e quando o usuário muda filtro/roteiro — não a cada refresh automático.
- Desligar por padrão o enriquecimento automático do navegador quando o cron do servidor está ativo, deixando o botão de lote manual (20) disponível.

## Detalhes técnicos

- `src/lib/tasks-map-api.ts`: filtro `merged_into`, `in("cnpj", …)` restrito aos CNPJs dos prospects, `Promise.all` nos lotes de ids, dedupe final por CNPJ, cache com metadados de truncamento.
- `src/routes/mapa.tsx`: bloco de erro/refetch, `useAutoEnrich({ autoStart: false })`, chave de enquadramento controlada.
- `src/components/TasksMap.tsx`: key única do `Marker` e `FitBounds` com dependência de "fitKey" em vez de `points`.
- Nenhuma migração de banco necessária.
