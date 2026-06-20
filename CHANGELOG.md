# Changelog INFINDA

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).
Versionamento [SemVer](https://semver.org/).

## [2.1.0] — 2026-06-20

### Adicionado
- **Multi-tenant Core (Fase 0.1)** — tabelas `organizations`, `organization_members`, `user_active_org`; função `current_org_id()`; RPCs `my_organizations()` e `set_active_org()`.
- **Isolamento por organização** aplicado via RLS RESTRICTIVE em 27 tabelas de negócio (clients, proposals*, contracts, contratos*, deals*, catalog*, financeiro, etc.).
- **Backfill** de dados existentes para organização default `INFINDA`.
- **Trigger** `on_auth_user_created_default_org` para vincular novos usuários automaticamente.
- **Switcher de organização** no header (estilo Slack/Notion).
- **Módulo de Formalização Contratual** — wizard de 8 etapas, assinatura digital (canvas), tabelas `contratos`, `contrato_documentos`, `contrato_eventos`, RPCs `criar_contrato_from_proposta` e `finalizar_contrato`.
- **CTA "Formalizar contrato"** em propostas aprovadas/convertidas.
- **Dashboard de contratos** com KPIs (MRR/ARR via `vw_contratos_kpis`).

### Alterado
- **Copy da proposta comercial** refatorada para tom consultivo/premium — eliminação de promessas de resultado, alinhamento ao estilo HubSpot/Salesforce/Accenture.
- **Adaptação dinâmica** da proposta por tipo de serviço (`serviceProfile.ts`) — todas as seções (Hero, Diagnóstico, Solução, Benefícios, ROI, Crescimento, Cases) ajustam linguagem ao escopo selecionado.

### Segurança
- Política RLS RESTRICTIVE combina via AND com as policies de papel existentes; nenhum dado vaza entre organizações.
- `DEFAULT current_org_id()` em `organization_id` evita inserts órfãos.

---

## [2.0.0] — versões anteriores

Base do CRM, propostas, briefings, kickoff, catálogo, prospecção e cadência.

[2.1.0]: #210--2026-06-20