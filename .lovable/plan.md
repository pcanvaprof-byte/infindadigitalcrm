# Exportar contatos da Prospecção para o disparador

## O que muda
Um botão **"Exportar contatos"** fica ao lado de "Limpar filtros", na Prospecção.

- Exporta **exatamente os leads que aparecem na lista com os filtros atuais** (status, nicho, cidade, UF, potencial, data de abertura, "somente com WhatsApp" etc.).
- Se houver leads marcados na caixinha da tabela, exporta **só os marcados**.
- O botão mostra quantos contatos vão sair: "Exportar contatos (36)".

## Arquivo gerado (planilha CSV, abre no Excel e importa em disparadores)
Colunas: `nome`, `empresa`, `whatsapp` (formato internacional, ex: 5547998272244), `telefone`, `email`, `cidade`, `uf`, `nicho`, `cnpj`, `mensagem` (primeira mensagem do Meu Negócio já personalizada), `prospect_id`.

Regras:
- Remove números inválidos (9999999999, 1111111111...) e números repetidos — cada WhatsApp aparece uma vez só.
- Nome do arquivo: `contatos-disparo-AAAA-MM-DD.csv`.
- Exportar **não** marca o lead como contactado (o disparo continua sendo registrado normalmente quando acontece).

## Detalhes técnicos
- Novo helper `src/lib/prospeccao/export-contacts.ts`: recebe `Prospect[]`, normaliza WhatsApp com a mesma lógica de `normalizeWhats`/`isJunkPhone`, dedupe por telefone, monta CSV com BOM UTF-8 e separador `;` (compatível com Excel pt-BR) e baixa via Blob.
- Mensagem: `renderTemplate` + `sanitizeTemplateForSend` sobre `business_profiles.initial_message` (já carregado pelo `useBusinessProfile`), com fallback em `pickNicheTemplate`.
- `src/routes/prospeccao.tsx`: botão perto da linha "Limpar filtros", usando `filtered` (ou a seleção da tabela).
- Sem mudança no banco, sem nova dependência.
