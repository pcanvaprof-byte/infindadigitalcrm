# Filtro por cidade na Prospecção (+ limpeza de cidades inválidas)

## 1. Filtro de Cidade

Adicionar um seletor de **Cidade** na barra de filtros de `/prospeccao`, ao lado do filtro de Estado.

- Lista de cidades montada a partir dos próprios leads (nome normalizado, sem duplicar por acento/caixa), em ordem alfabética e com a contagem de leads.
- Quando um Estado estiver selecionado, a lista mostra apenas as cidades daquele Estado.
- Seletor com busca (mesmo padrão do filtro de Nicho), porque a base tem muitas cidades.
- Opção "Todas as cidades" para limpar; o filtro entra no botão "Limpar filtros" e na contagem de filtros ativos.
- Vale para a lista, os cartões, as estatísticas e o mapa da própria página. Leads sem cidade ficam de fora quando uma cidade é escolhida.

## 2. Leads com número no lugar do nome da cidade

Não é possível conferir esses registros por consulta agora: o banco acessível por consulta direta está vazio, os dados reais estão no banco conectado da aplicação. Então a verificação será feita pela própria tela, sem depender de consulta prévia:

- Um valor de cidade é considerado inválido quando não contém nenhuma letra (ex.: "1234", "0", "-") ou quando é só número/CEP.
- Esses valores não entram na lista do seletor de cidade (não poluem o filtro).
- Um item "Cidade inválida (N)" aparece no final da lista, permitindo isolar exatamente esses leads para correção.
- Na exibição do lead, cidade inválida aparece como vazia em vez de mostrar o número.
- Esses leads entram na fila de enriquecimento por CNPJ já existente, que preenche cidade/UF corretas quando disponíveis — nada é apagado no banco.

## Detalhes técnicos

- `src/routes/prospeccao.tsx`: novo estado `cityFilter`; aplicado no `filtered` (comparação normalizada de `p.city`); `availableCities` derivado com `useMemo` respeitando `stateFilter`; incluído nas dependências dos memos, em `hasActiveFilters` e no limpar filtros.
- Helpers `normalizeCity(v)` e `isValidCityName(v)` (exige ao menos uma letra, descarta CEP/números) num módulo utilitário reutilizável pelo Mapa depois.
- O seletor reutiliza `Command`/`Popover` já usados no filtro de nicho — nenhuma dependência nova, nenhuma mudança de banco.
