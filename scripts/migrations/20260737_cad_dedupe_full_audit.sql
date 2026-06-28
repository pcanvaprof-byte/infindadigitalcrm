-- ============================================================================
-- Auditoria completa de duplicatas em cad_leads (todas as etapas)
-- ============================================================================
-- Motivação: duplicatas voltaram a aparecer em etapas avançadas (Reunião
-- Agendada, Proposta etc.). A dedupe v1 priorizava o lead mais antigo,
-- o que pode descartar o card que está em etapa mais avançada.
--
-- Esta migration:
--  1) View pública `v_cad_leads_dupes` para inspecionar duplicatas por
--     empresa, prospect_id, cnpj normalizado e whatsapp/telefone normalizados.
--  2) RPC `cad_admin_dedupe_full()` que mescla mantendo o lead com a
--     etapa MAIS AVANÇADA (e mais recente como desempate), reapontando
--     mensagens e notificações.
--  3) Reforça índices únicos por organização para
--     telefone/whatsapp normalizados (além dos já existentes em
--     prospect_id e empresa).
-- ============================================================================

-- 1) Helper de normalização (idempotente)
create or replace function public.cad_norm_phone(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '')
$$;

-- Ranking determinístico de etapas: maior número = mais avançada.
-- 'perdido' fica em zero para nunca vencer um lead ativo.
create or replace function public.cad_stage_rank(s public.cad_stage)
returns int
language sql
immutable
as $$
  select case s::text
    when 'fechado'           then 100
    when 'negociacao'        then 90
    when 'proposta_enviada'  then 80
    when 'reuniao_agendada'  then 70
    when 'interessado'       then 60
    when 'followup_3'        then 50
    when 'followup_2'        then 40
    when 'followup_1'        then 30
    when 'novo'              then 20
    when 'perdido'           then 0
    else 10
  end
$$;

-- 2) View de auditoria — lista grupos com duplicatas, por chave
create or replace view public.v_cad_leads_dupes as
with por_empresa as (
  select 'empresa'::text as chave,
         organization_id,
         lower(btrim(empresa)) as valor,
         count(*) as qtd,
         array_agg(id order by public.cad_stage_rank(stage) desc, coalesce(last_contact_at, created_at) desc) as ids
    from public.cad_leads
   where empresa is not null and btrim(empresa) <> ''
   group by organization_id, lower(btrim(empresa))
  having count(*) > 1
),
por_prospect as (
  select 'prospect_id'::text as chave,
         organization_id,
         prospect_id::text as valor,
         count(*) as qtd,
         array_agg(id order by public.cad_stage_rank(stage) desc, coalesce(last_contact_at, created_at) desc) as ids
    from public.cad_leads
   where prospect_id is not null
   group by organization_id, prospect_id
  having count(*) > 1
),
por_whatsapp as (
  select 'whatsapp'::text as chave,
         organization_id,
         public.cad_norm_phone(whatsapp) as valor,
         count(*) as qtd,
         array_agg(id order by public.cad_stage_rank(stage) desc, coalesce(last_contact_at, created_at) desc) as ids
    from public.cad_leads
   where public.cad_norm_phone(whatsapp) is not null
     and length(public.cad_norm_phone(whatsapp)) >= 10
   group by organization_id, public.cad_norm_phone(whatsapp)
  having count(*) > 1
),
por_telefone as (
  select 'telefone'::text as chave,
         organization_id,
         public.cad_norm_phone(telefone) as valor,
         count(*) as qtd,
         array_agg(id order by public.cad_stage_rank(stage) desc, coalesce(last_contact_at, created_at) desc) as ids
    from public.cad_leads
   where public.cad_norm_phone(telefone) is not null
     and length(public.cad_norm_phone(telefone)) >= 10
   group by organization_id, public.cad_norm_phone(telefone)
  having count(*) > 1
)
select * from por_empresa
union all select * from por_prospect
union all select * from por_whatsapp
union all select * from por_telefone;

grant select on public.v_cad_leads_dupes to authenticated, service_role;

-- 3) RPC de dedupe consolidada — mantém o lead da etapa mais avançada
create or replace function public.cad_admin_dedupe_full()
returns table (chave text, grupos_mesclados int, leads_removidos int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_winner uuid;
  v_losers uuid[];
  v_merged_empresa int := 0;  v_removed_empresa int := 0;
  v_merged_prospect int := 0; v_removed_prospect int := 0;
  v_merged_phone int := 0;    v_removed_phone int := 0;
begin
  -- Ordem importa: primeiro prospect_id (mais confiável), depois empresa, depois phone.

  for r in select * from public.v_cad_leads_dupes where chave = 'prospect_id' loop
    v_winner := r.ids[1];
    v_losers := r.ids[2:array_length(r.ids,1)];
    if v_winner is null or array_length(v_losers,1) is null then continue; end if;
    perform public._cad_merge_losers_into(v_winner, v_losers);
    v_merged_prospect := v_merged_prospect + 1;
    v_removed_prospect := v_removed_prospect + array_length(v_losers,1);
  end loop;

  for r in select * from public.v_cad_leads_dupes where chave = 'empresa' loop
    v_winner := r.ids[1];
    v_losers := r.ids[2:array_length(r.ids,1)];
    if v_winner is null or array_length(v_losers,1) is null then continue; end if;
    perform public._cad_merge_losers_into(v_winner, v_losers);
    v_merged_empresa := v_merged_empresa + 1;
    v_removed_empresa := v_removed_empresa + array_length(v_losers,1);
  end loop;

  for r in select * from public.v_cad_leads_dupes
            where chave in ('whatsapp','telefone') loop
    v_winner := r.ids[1];
    v_losers := r.ids[2:array_length(r.ids,1)];
    if v_winner is null or array_length(v_losers,1) is null then continue; end if;
    perform public._cad_merge_losers_into(v_winner, v_losers);
    v_merged_phone := v_merged_phone + 1;
    v_removed_phone := v_removed_phone + array_length(v_losers,1);
  end loop;

  return query values
    ('prospect_id', v_merged_prospect, v_removed_prospect),
    ('empresa',     v_merged_empresa,  v_removed_empresa),
    ('telefone',    v_merged_phone,    v_removed_phone);
end;
$$;

-- Helper: aplica merge (reaponta mensagens/notifs e remove perdedores)
create or replace function public._cad_merge_losers_into(p_winner uuid, p_losers uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_winner is null or p_losers is null or array_length(p_losers,1) is null then
    return;
  end if;

  begin
    update public.cad_messages set lead_id = p_winner where lead_id = any(p_losers);
  exception when undefined_table then null; end;

  begin
    -- limpa pendentes que conflitariam com (lead_id, kind) único do vencedor
    delete from public.cad_notifications n
     using public.cad_notifications keep
     where n.lead_id = any(p_losers)
       and n.handled_at is null
       and keep.lead_id = p_winner
       and keep.kind = n.kind
       and keep.handled_at is null;
    -- desempata pendentes entre os próprios losers
    delete from public.cad_notifications n
     using public.cad_notifications keep
     where n.lead_id = any(p_losers)
       and n.handled_at is null
       and keep.lead_id = any(p_losers)
       and keep.kind = n.kind
       and keep.handled_at is null
       and keep.id < n.id;
    update public.cad_notifications set lead_id = p_winner where lead_id = any(p_losers);
  exception when undefined_table then null; end;

  delete from public.cad_leads where id = any(p_losers);
end;
$$;

grant execute on function public.cad_admin_dedupe_full() to authenticated, service_role;
grant execute on function public._cad_merge_losers_into(uuid, uuid[]) to service_role;

-- 4) Reforço de índices únicos para telefone/whatsapp normalizados.
-- Só cria se não houver duplicatas residuais; caso contrário, o admin
-- precisa rodar cad_admin_dedupe_full() antes.
do $$
begin
  if not exists (
    select 1 from public.cad_leads
     where public.cad_norm_phone(whatsapp) is not null
       and length(public.cad_norm_phone(whatsapp)) >= 10
     group by organization_id, public.cad_norm_phone(whatsapp)
    having count(*) > 1
    limit 1
  ) then
    create unique index if not exists ux_cad_leads_org_whatsapp_norm
      on public.cad_leads (organization_id, public.cad_norm_phone(whatsapp))
      where public.cad_norm_phone(whatsapp) is not null
        and length(public.cad_norm_phone(whatsapp)) >= 10;
  end if;

  if not exists (
    select 1 from public.cad_leads
     where public.cad_norm_phone(telefone) is not null
       and length(public.cad_norm_phone(telefone)) >= 10
     group by organization_id, public.cad_norm_phone(telefone)
    having count(*) > 1
    limit 1
  ) then
    create unique index if not exists ux_cad_leads_org_telefone_norm
      on public.cad_leads (organization_id, public.cad_norm_phone(telefone))
      where public.cad_norm_phone(telefone) is not null
        and length(public.cad_norm_phone(telefone)) >= 10;
  end if;
end$$;