-- Dedupe completo cad_leads: cria view de auditoria, normaliza telefones
-- (ignora junk como 0000…, 9999…, repetidos), executa merge preservando o
-- card na etapa mais avançada e reforça índices únicos.

-- 1. Normalização robusta de telefone --------------------------------------
create or replace function public.cad_norm_phone(p text)
returns text language sql immutable as $$
  select case
    when p is null then null
    -- só dígitos
    when regexp_replace(p, '\D', '', 'g') = '' then null
    -- menos de 8 dígitos = inválido
    when length(regexp_replace(p, '\D', '', 'g')) < 8 then null
    -- todos dígitos iguais (0000…, 9999…, 1111…)
    when regexp_replace(p, '\D', '', 'g') ~ '^(\d)\1+$' then null
    -- padrões obvios de placeholder
    when regexp_replace(p, '\D', '', 'g') in ('1234567890','0123456789','8590000000') then null
    else right(regexp_replace(p, '\D', '', 'g'), 11)
  end
$$;

-- 2. Ranking de estágio (mais avançado vence) ------------------------------
create or replace function public.cad_stage_rank(s text)
returns int language sql immutable as $$
  select case lower(coalesce(s,'novo'))
    when 'novo' then 0
    when 'follow_up_1' then 1
    when 'follow_up_2' then 2
    when 'follow_up_3' then 3
    when 'follow_up_4' then 4
    when 'interessado' then 5
    when 'reuniao' then 6
    when 'negociacao' then 7
    when 'fechado' then 8
    when 'perdido' then -1
    else 0
  end
$$;

-- 3. View de auditoria -----------------------------------------------------
create or replace view public.v_cad_leads_dupes as
with norm as (
  select id, organization_id, stage,
         lower(btrim(coalesce(empresa,''))) as empresa_n,
         public.cad_norm_phone(whatsapp) as wa_n,
         public.cad_norm_phone(telefone) as tel_n,
         prospect_id
  from public.cad_leads
)
select 'whatsapp'::text as chave, organization_id, wa_n as valor,
       count(*) as qtd, array_agg(id order by public.cad_stage_rank(stage) desc, id) as ids
from norm where wa_n is not null
group by organization_id, wa_n having count(*) > 1
union all
select 'telefone', organization_id, tel_n, count(*),
       array_agg(id order by public.cad_stage_rank(stage) desc, id)
from norm where tel_n is not null
group by organization_id, tel_n having count(*) > 1
union all
select 'empresa', organization_id, empresa_n, count(*),
       array_agg(id order by public.cad_stage_rank(stage) desc, id)
from norm where empresa_n <> ''
group by organization_id, empresa_n having count(*) > 1
union all
select 'prospect', organization_id, prospect_id::text, count(*),
       array_agg(id order by public.cad_stage_rank(stage) desc, id)
from norm where prospect_id is not null
group by organization_id, prospect_id having count(*) > 1;

-- 4. RPC de dedupe ---------------------------------------------------------
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
           where proname = 'cad_admin_dedupe_full'
             and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || r.sig || ' cascade';
  end loop;
end$$;
create or replace function public.cad_admin_dedupe_full()
returns table(grupo text, mantidos int, removidos int)
language plpgsql security definer set search_path=public as $$
declare
  r record;
  winner uuid;
  losers uuid[];
  total_kept int := 0;
  total_removed int := 0;
begin
  for r in select * from public.v_cad_leads_dupes loop
    winner := r.ids[1];
    losers := r.ids[2:array_length(r.ids,1)];
    if losers is null or array_length(losers,1) is null then continue; end if;
    -- migra mensagens e notificações se existirem essas tabelas
    begin
      update public.cad_messages set cad_lead_id = winner where cad_lead_id = any(losers);
    exception when undefined_table then null; end;
    begin
      update public.notifications set cad_lead_id = winner where cad_lead_id = any(losers);
    exception when undefined_table then null; end;
    delete from public.cad_leads where id = any(losers);
    total_kept := total_kept + 1;
    total_removed := total_removed + coalesce(array_length(losers,1),0);
  end loop;
  return query select 'cad_leads'::text, total_kept, total_removed;
end$$;

grant execute on function public.cad_admin_dedupe_full() to authenticated;

-- 5. Executa dedupe agora --------------------------------------------------
select * from public.cad_admin_dedupe_full();

-- 6. Índices únicos (idempotentes) ----------------------------------------
drop index if exists public.ux_cad_leads_org_whatsapp_norm;
drop index if exists public.ux_cad_leads_org_telefone_norm;
create unique index ux_cad_leads_org_whatsapp_norm
  on public.cad_leads(organization_id, public.cad_norm_phone(whatsapp))
  where public.cad_norm_phone(whatsapp) is not null and lower(coalesce(stage,'')) <> 'perdido';
create unique index ux_cad_leads_org_telefone_norm
  on public.cad_leads(organization_id, public.cad_norm_phone(telefone))
  where public.cad_norm_phone(telefone) is not null and lower(coalesce(stage,'')) <> 'perdido';
