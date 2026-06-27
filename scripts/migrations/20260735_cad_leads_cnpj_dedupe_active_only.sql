-- ============================================================================
-- Permite reentrada de leads encerrados (perdido/ganho) sem violar índices
-- ============================================================================
-- Refina os índices únicos de cad_leads para considerar apenas leads ativos.
-- Assim, uma empresa/CNPJ que foi marcada como perdido/ganho pode voltar
-- a entrar na cadência sem ser bloqueada pela trava de duplicatas.

drop index if exists ux_cad_leads_org_cnpj;
drop index if exists ux_cad_leads_org_empresa_no_cnpj;
drop index if exists ux_cad_leads_org_prospect;

create unique index if not exists ux_cad_leads_org_prospect_active
  on public.cad_leads (organization_id, prospect_id)
  where prospect_id is not null
    and stage not in ('perdido','fechado');

create unique index if not exists ux_cad_leads_org_cnpj_active
  on public.cad_leads (organization_id, cnpj)
  where cnpj is not null
    and stage not in ('perdido','fechado');

create unique index if not exists ux_cad_leads_org_empresa_no_cnpj_active
  on public.cad_leads (organization_id, lower(btrim(empresa)))
  where cnpj is null
    and empresa is not null
    and btrim(empresa) <> ''
    and stage not in ('perdido','fechado');
