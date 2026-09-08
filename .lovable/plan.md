# Filtro por cidade na Prospecção

Adicionar um seletor de **Cidade** na barra de filtros de `/prospeccao`, ao lado do filtro de Estado.

## Como vai funcionar

- Lista de cidades montada a partir dos próprios leads (cidade normalizada, sem duplicar por acento/caixa), em ordem alfabética e com a contagem de leads.
- Quando um Estado estiver selecionado, a lista de cidades mostra apenas as cidades daquele Estado.
- Como a base tem muitas cidades, o seletor é do tipo busca (mesmo padrão do filtro de Nicho), permitindo digitar para encontrar a cidade.
- Opção "Todas as cidades" para limpar.
- O filtro entra no botão "Limpar filtros" e na contagem de filtros ativos, e vale também para a lista, os cartões, as estatísticas e o mapa da própria página.
- Leads sem cidade cadastrada ficam de fora quando uma cidade é escolhida.

## Detalhes técnicos

- `src/routes/prospeccao.tsx`: novo estado `cityFilter`; aplicado no `filtered` (comparação normalizada de `p.city`); `availableCities` derivado com `useMemo` respeitando `stateFilter`; incluído nas dependências dos memos e em `hasActiveFilters`/limpar filtros.
- O seletor reutiliza `Command`/`Popover` já usados no filtro de nicho — nenhuma dependência nova, nenhuma mudança de banco.
