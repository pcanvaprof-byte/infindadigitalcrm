# Enriquecimento em background + Nichos padronizados + Filtro por data de abertura

## 1. Enriquecimento automático no servidor (cron)

Hoje o ciclo de 20 CNPJs/60s só roda enquanto alguém deixa uma aba de Prospecção ou Mapa aberta. A ideia é mover esse mesmo ciclo para o servidor.

- Nova rota de servidor `src/routes/api/public/hooks/enrich-batch.ts` (POST), protegida pela chave pública do backend no header.
- A rota busca até **20 leads pendentes** por execução (sem nome real, CNPJ incompleto, sem CEP/logradouro ou sem coordenadas), executa o mesmo pipeline (Receita → ViaCEP → Geo → IBGE → Score) e grava perfil, endereço, localização, indicadores e score, além de sincronizar os campos do lead (nome, CNPJ completo, telefone, cidade/UF, nicho).
- Espaçamento de ~1,1s entre CNPJs dentro do lote, para respeitar os limites das APIs públicas.
- Agendamento: **a cada 1 minuto**, via cron no banco chamando a rota pela URL estável do projeto.
- Cada execução grava log de auditoria (`company_enrichment_logs`) com status/erro, para o acompanhamento que já usamos.
- Segurança e escopo: como o enriquecimento já é compartilhado por organização, o job roda com identidade de sistema. Antes de implementar, confirmo em produção como as tabelas `company_*` aceitam a gravação do job (as colunas de dono são obrigatórias) e, se necessário, a migração adiciona um dono de sistema/coluna nula controlada — sem alterar o comportamento atual do enriquecimento feito pelo usuário.
- O ciclo do navegador continua existindo, mas deixa de ser necessário: passa a ser complementar (não vou removê-lo agora).

## 2. Nichos principais estruturados (taxonomia fixa)

Novo módulo `src/lib/niches.ts` com ~15 grupos principais, por exemplo: Alimentação, Saúde & Bem-estar, Beleza & Estética, Construção & Reforma, Automotivo, Varejo, Serviços B2B, Educação, Tecnologia, Imobiliário, Logística & Transporte, Turismo & Hospedagem, Pet, Financeiro & Contábil, Indústria, Outros.

- Mapeamento automático do que já existe na base: o texto do segmento/CNAE de cada lead é normalizado (sem acento, minúsculo) e classificado por palavras-chave e prefixo de CNAE.
- Nada é apagado: o segmento original continua salvo e visível; o grupo é derivado na exibição e nos filtros.
- Os filtros de nicho de `/prospeccao` e `/mapa` passam a mostrar os grupos principais (com contagem), mantendo a opção de busca por texto livre para o segmento detalhado.

## 3. Filtro por data de abertura do CNPJ

Em `/prospeccao` e `/mapa`:

- Faixas rápidas: até 1 ano, 1–3 anos, 3–10 anos, +10 anos.
- Intervalo personalizado: data inicial e final.
- A data de abertura passa a aparecer também na lista/cards de Prospecção (no Mapa e no roteiro ela já aparece).
- Leads ainda sem data de abertura (não enriquecidos) ficam fora quando um filtro de data está ativo, com aviso na tela indicando quantos foram omitidos.

## Detalhes técnicos

- `src/lib/enrichment/pipeline.server.ts`: extrai o pipeline atual de `src/lib/enrichment/api.ts` para um módulo reutilizável no servidor (mesma normalização de endereço, `completeCnpj` e cálculo de score), evitando duplicar regra de negócio.
- SQL em `scripts/migrations/` (padrão do projeto), aplicado ao projeto de produção: agendamento do cron (pg_cron + pg_net) e eventuais ajustes de permissão/coluna de dono para o job.
- `src/routes/prospeccao.tsx`: adiciona `dateFilter` (faixa + intervalo) ao pipeline de filtros existente e usa o grupo de nicho no seletor.
- `src/lib/tasks-map-api.ts` já traz `data_abertura`; `src/routes/mapa.tsx` ganha os mesmos controles de data e o seletor de nicho por grupo.
- Painel de acompanhamento do cron (execuções, sucesso/erro, pendentes) fica restrito a Owner/Admin, reaproveitando o guard já existente.
