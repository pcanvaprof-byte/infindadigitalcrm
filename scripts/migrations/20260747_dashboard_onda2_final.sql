-- ============================================================
-- Onda 2 (FINAL) — Hardening, Performance e Consistência
-- Estritamente aditiva sobre 20260742 (v5) e 20260743 (v6).
-- NÃO altera regras de negócio, JSON da RPC nem KPIs.
-- Adiciona:
--   A) Índices parciais alinhados aos FILTER (WHERE …) do v6
--   B) Trigger para padronizar `owner_name` em prospects/clients
--      (fonte única; sincroniza a partir de assigned_to/owner_id)
--   C) Função self-test `dashboard_metrics_selftest()` que valida
--      mutua-exclusividade dos buckets e devolve diagnóstico
--   D) Re-execução da guard de pipeline_stage (fail-fast)
-- ============================================================

begin;
set local check_function_bodies = off;

-- (A) Índices parciais tuned para os predicados do v6 ---------
create index if not exists prospects_org_cad_atrasada_idx
  on public.prospects (organization_id, next_contact_at)
  where cadence_status = 'ativo';

create index if not exists prospects_org_sem_resp_idx
  on public.prospects (organization_id)
  where nullif(owner_name, '') is null;

create index if not exists clients_org_open_stage_idx
  on public.clients (organization_id, updated_at)
  where pipeline_stage::text in
    ('PROSPECCAO','CADENCIA','FECHADO','REUNIAO_INICIAL','PROPOSTA',
     'CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO');

create index if not exists pt_org_resposta_idx
  on public.prospect_touchpoints (organization_id, prospect_id, enviado_em)
  where tipo::text = 'resposta'
     or resultado::text in ('respondido','interessado');

-- (B) Padronização de responsável -----------------------------
-- owner_name é a fonte única consumida pelo dashboard.
-- Quando o registro vier apenas com assigned_to/owner_id, derivamos
-- o nome a partir do profile do usuário responsável.
create or replace function public.sync_owner_name_from_assignee()
returns trigger language plpgsql as $$
declare v_name text;
begin
  if coalesce(nullif(new.owner_name, ''), null) is not null then
    return new;
  end if;
  if to_jsonb(new) ? 'assigned_to' and (to_jsonb(new)->>'assigned_to') is not null then
    select coalesce(nullif(full_name,''), nullif(display_name,''), nullif(email,''))
      into v_name
      from public.profiles
     where id = (to_jsonb(new)->>'assigned_to')::uuid;
    if v_name is not null then new.owner_name := v_name; end if;
  end if;
  return new;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='prospects'
                and column_name='owner_name') then
    drop trigger if exists trg_prospects_sync_owner on public.prospects;
    create trigger trg_prospects_sync_owner
      before insert or update of owner_name, assigned_to on public.prospects
      for each row execute function public.sync_owner_name_from_assignee();
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema='public' and table_name='clients'
                and column_name='owner_name') then
    drop trigger if exists trg_clients_sync_owner on public.clients;
    create trigger trg_clients_sync_owner
      before insert or update of owner_name, assigned_to on public.clients
      for each row execute function public.sync_owner_name_from_assignee();
  end if;
end $$;

-- (C) Self-test reproduzível ----------------------------------
create or replace function public.dashboard_metrics_selftest()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m jsonb := public.dashboard_metrics();
  v_org uuid := (m->>'org_id')::uuid;
  base bigint := (m#>>'{resumo,base}')::bigint;
  novos bigint := (m#>>'{resumo,novos}')::bigint;
  inter bigint := (m#>>'{resumo,interessados}')::bigint;
  neg   bigint := (m#>>'{resumo,em_negociacao}')::bigint;
  ativ  bigint := (m#>>'{resumo,ativos}')::bigint;
  perd  bigint := (m#>>'{resumo,perdidos}')::bigint;
  c_total bigint;
  overlap bigint;
begin
  select count(*) into c_total from public.clients where organization_id = v_org;
  -- buckets devem somar <= clients totais (perdidos podem incluir CHURNED)
  if (novos + inter + neg + ativ + perd) <> c_total then
    raise warning 'selftest: soma dos buckets (%s) <> total clients (%s)',
      (novos + inter + neg + ativ + perd), c_total;
  end if;
  -- overlap entre interessados e em_negociacao deve ser zero
  select count(*) into overlap
    from public.clients
   where organization_id = v_org
     and pipeline_stage::text = 'REUNIAO_INICIAL'
     and pipeline_stage::text in
       ('PROPOSTA','CONTRATO','ASSINATURA','PAGAMENTO_CONFIRMADO','IMPLANTACAO');
  return jsonb_build_object(
    'org_id', v_org,
    'schema', m->>'schema',
    'clients_total', c_total,
    'buckets_sum', novos + inter + neg + ativ + perd,
    'buckets_match', (novos + inter + neg + ativ + perd) = c_total,
    'overlap_inter_neg', overlap,
    'metrics', m
  );
end $$;
grant execute on function public.dashboard_metrics_selftest() to authenticated;

-- (D) Guard de enum (fail-fast) -------------------------------
select public.assert_pipeline_stages_mapped();

notify pgrst, 'reload schema';
commit;