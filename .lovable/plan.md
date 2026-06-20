## Módulo de Formalização Contratual — INFINDA

Transformar propostas aprovadas em contratos formais por meio de um wizard premium de 8 etapas, com automações pós-assinatura, dashboard, histórico e central de documentos.

Como o escopo é muito grande, proponho entregar em **4 fases incrementais**, todas no mesmo padrão visual (dark, premium, cards elegantes, animações discretas) já adotado nas propostas.

---

### Fase 1 — Fundação (banco + fluxo base)

**Banco (migration)**
- `contracts` — vínculo 1:1 com `proposals`, status, número (`CTR-YYYY-NNNN`), valores espelhados, datas, owner.
- `contract_parties` — PF/PJ, todos os campos do contratante, endereço.
- `contract_financials` — método de pagamento, vencimento, parcelamento, dados bancários.
- `contract_scope_items` — derivado dos itens da proposta + entregáveis dinâmicos por tipo de serviço.
- `contract_acceptances` — checkboxes + IP/data/hora/user.
- `contract_signatures` — tipo (desenhada/digitada/email), payload, IP, hora.
- `contract_documents` — uploads (Storage bucket privado `contracts`).
- `contract_events` — histórico (criado, editado, assinado, etc).
- Status enum: `aguardando_formalizacao | em_preenchimento | aguardando_assinatura | assinado | pendente_financeiro | ativo | cancelado | encerrado`.
- GRANTs + RLS por role (admin, comercial, financeiro, producao, cliente via token).
- Trigger: ao aprovar proposta → cria `contracts` em `aguardando_formalizacao`.

**Bucket**
- `contracts` (privado) para documentos do cliente e PDF final.

**Rota e CTA**
- Botão "Formalizar Contrato" na proposta quando status = aprovada.
- Nova rota `/_authenticated/contratos/$id` (wizard) e `/_authenticated/contratos` (lista).

---

### Fase 2 — Wizard de 8 etapas

Componente `ContractWizard` com header sticky (nº proposta, cliente, consultor, implantação, mensalidade, status, data) e stepper horizontal.

1. **Informações Gerais** — resumo read-only puxado da proposta.
2. **Contratante** — toggle PF/PJ + formulário com validação Zod, máscara CPF/CNPJ/CEP, lookup CEP automático, uploads (preview).
3. **Financeiro** — método, vencimento, parcelamento, dados bancários condicionais.
4. **Escopo** — leitura dos itens da proposta + entregáveis dinâmicos baseados em `serviceProfile.ts` (tráfego, CRM, IA, site, landing).
5. **Condições** — resumo gerado + botão "Visualizar Contrato Completo" (PDF).
6. **Aceites** — 4 checkboxes obrigatórios, bloqueio de avanço.
7. **Assinatura** — canvas (desenhada), input (digitada), envio por e-mail (placeholder para Clicksign/DocuSign), registro de IP/hora.
8. **Conclusão** — animação de sucesso, número do contrato, botões (PDF, e-mail, download, ir para Kickoff).

Persistência incremental: cada etapa salva via server function (`saveContractStep`) com middleware `requireSupabaseAuth`. Auto-save discreto.

---

### Fase 3 — Automações pós-assinatura

Server function `finalizeContract` (transação):
- Status proposta → `contrato_formalizado`.
- Cria/vincula `client` no CRM.
- Cria projeto + cronograma + kickoff (reaproveita `briefings` existente).
- Cria registro financeiro + primeira cobrança.
- Gera tarefas internas padrão.
- Cria pasta lógica de documentos.
- Dispara e-mail + WhatsApp (placeholder com link `wa.me`).
- Registra evento em `contract_events` e `proposal_events`.

PDF do contrato gerado server-side com template consultivo (mesma linguagem premium das propostas).

---

### Fase 4 — Dashboard, histórico e documentos

- `/_authenticated/contratos` com:
  - KPIs: ativos, pendentes, assinados, cancelados, tempo médio assinatura, MRR, ARR, ticket médio, conversão proposta→contrato.
  - Tabela com filtros por status, consultor, período.
- Drawer/aba **Histórico** no contrato (timeline de `contract_events`).
- Drawer/aba **Documentos** (lista + upload + preview + download + versionamento simples).
- Permissões aplicadas via `has_role` em todas as queries/mutations.

---

### Detalhes técnicos

- **Stack**: TanStack Start + server functions + Supabase (Lovable Cloud) + Tailwind v4 + shadcn.
- **Validação**: Zod schemas compartilhados em `src/lib/contratos/schema.ts`.
- **API**: `src/lib/contratos/api.ts` (client), `src/lib/contratos/*.functions.ts` (server), `src/lib/contratos/pdf.ts` (geração).
- **UI**: `src/components/contratos/` (Wizard, Stepper, StepHeader, steps/*, dialogs/*).
- **Design tokens**: mantém paleta atual; nenhum hardcoded color.
- **Arquitetura preparada** para Clicksign/DocuSign/Asaas/Stripe (interfaces tipadas em `src/lib/contratos/integrations/`).
- **Eventos**: reaproveita padrão `logEvent` já existente.

---

### Confirmações antes de começar

1. Posso começar pela **Fase 1 + Fase 2** (fundação + wizard funcional ponta a ponta com persistência), entregando Fases 3 e 4 nas próximas iterações? Isso garante algo navegável já no primeiro turno, sem 30+ arquivos quebrados ao mesmo tempo.
2. Para assinatura eletrônica nesta primeira versão: assinatura **desenhada (canvas) + digitada** já cobre o MVP — Clicksign/DocuSign ficam como interface preparada, ativadas depois quando você quiser conectar as contas. OK?
3. PDF do contrato: gero com template consultivo próprio (mesma linguagem das propostas refatoradas), OK?
