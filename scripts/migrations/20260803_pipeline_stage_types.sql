-- P5 — Tipos estáveis de estágio do funil.
-- Hoje o frontend (src/routes/bi.tsx:286-291) descobre estágios via regex
-- /lead|prospec/, /reuni/, /propos/, /contrat|fech/ — qualquer rename quebra
-- silenciosamente. Vamos introduzir um enum estável e popular cad_leads.

do $$ begin
  create type public.pipeline_stage_type as enum (
    'LEAD', 'CONTACT', 'MEETING', 'PROPOSAL', 'CONTRACT', 'WON', 'LOST'
  );
exception when duplicate_object then null; end $$;

alter table public.cad_leads
  add column if not exists stage_type public.pipeline_stage_type;

create index if not exists ix_cad_leads_stage_type on public.cad_leads (stage_type);

-- Backfill: traduz stage textual para enum (roda uma vez)
update public.cad_leads set stage_type = case
  when lower(coalesce(stage,'')) ~ 'ganho|fech|won|contrat' then 'CONTRACT'::public.pipeline_stage_type
  when lower(coalesce(stage,'')) ~ 'propos'                 then 'PROPOSAL'::public.pipeline_stage_type
  when lower(coalesce(stage,'')) ~ 'reuni|meet'             then 'MEETING'::public.pipeline_stage_type
  when lower(coalesce(stage,'')) ~ 'contact|contato|conta'  then 'CONTACT'::public.pipeline_stage_type
  when lower(coalesce(stage,'')) ~ 'perd|lost'              then 'LOST'::public.pipeline_stage_type
  else 'LEAD'::public.pipeline_stage_type
end
where stage_type is null;

-- bi_dashboard: expor stage_type junto do funil (mantém compat com stage textual)
-- Recriamos um wrapper bi_funnel_stable que devolve já o enum agregado.
create or replace function public.bi_funnel_stable(p_org uuid)
returns table(stage_type public.pipeline_stage_type, clientes int, tempo_medio_dias numeric)
language sql stable security definer set search_path = public as $$
  select
    coalesce(l.stage_type, 'LEAD'::public.pipeline_stage_type) as stage_type,
    count(*)::int as clientes,
    coalesce(avg(extract(epoch from (now() - l.created_at))/86400)::numeric(10,1), 0) as tempo_medio_dias
  from public.cad_leads l
  where l.organization_id = p_org
  group by coalesce(l.stage_type, 'LEAD'::public.pipeline_stage_type)
  order by case coalesce(l.stage_type,'LEAD'::public.pipeline_stage_type)
    when 'LEAD' then 1 when 'CONTACT' then 2 when 'MEETING' then 3
    when 'PROPOSAL' then 4 when 'CONTRACT' then 5 when 'WON' then 6
    when 'LOST' then 7 end;
$$;

grant execute on function public.bi_funnel_stable(uuid) to authenticated, service_role;