-- Deduplicação de prospects por identidade única (CNPJ ou Nome+Cidade)
-- Mantém a linha mais antiga, arquiva as duplicatas e reponta referências.

begin;

-- 1. Nova coluna para rastro de merge (não apaga nada)
alter table public.prospects add column if not exists merged_into uuid references public.prospects(id);

-- 2. Função de normalização para o merge
create or replace function public._prospect_norm_cnpj(c text) returns text language sql immutable as $$
  select substring(regexp_replace(coalesce(c, ''), '\D', '', 'g') from 1 for 8);
$$;

create or replace function public._prospect_norm_name(n text) returns text language sql immutable as $$
  select lower(trim(coalesce(n, '')));
$$;

create or replace function public._prospect_norm_city(c text) returns text language sql immutable as $$
  select lower(trim(coalesce(c, '')));
$$;

-- 3. Identificar e repontar (apenas prospects que não foram arquivados)
do $$
declare
  r record;
  canonical_id uuid;
begin
  for r in (
    select _prospect_norm_cnpj(cnpj) as cn, organization_id, count(*)
    from public.prospects
    where merged_into is null and length(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')) >= 8
    group by 1, 2
    having count(*) > 1
  ) loop
    select id into canonical_id
    from public.prospects
    where _prospect_norm_cnpj(cnpj) = r.cn
      and organization_id = r.organization_id
      and merged_into is null
    order by created_at asc limit 1;

    update public.prospect_touchpoints
    set prospect_id = canonical_id
    where prospect_id in (
      select id from public.prospects
      where _prospect_norm_cnpj(cnpj) = r.cn
        and organization_id = r.organization_id
        and id <> canonical_id
    );

    update public.cad_leads
    set prospect_id = canonical_id
    where prospect_id in (
      select id from public.prospects
      where _prospect_norm_cnpj(cnpj) = r.cn
        and organization_id = r.organization_id
        and id <> canonical_id
    );

    update public.prospects
    set merged_into = canonical_id
    where _prospect_norm_cnpj(cnpj) = r.cn
      and organization_id = r.organization_id
      and id <> canonical_id
      and merged_into is null;
  end loop;

  for r in (
    select _prospect_norm_name(company) as nm, _prospect_norm_city(city) as ct, organization_id, count(*)
    from public.prospects
    where merged_into is null
    group by 1, 2, 3
    having count(*) > 1
  ) loop
    select id into canonical_id
    from public.prospects
    where _prospect_norm_name(company) = r.nm
      and _prospect_norm_city(city) = r.ct
      and organization_id = r.organization_id
      and merged_into is null
    order by created_at asc limit 1;

    update public.prospect_touchpoints set prospect_id = canonical_id
    where prospect_id in (select id from public.prospects where _prospect_norm_name(company) = r.nm and _prospect_norm_city(city) = r.ct and organization_id = r.organization_id and id <> canonical_id);

    update public.cad_leads set prospect_id = canonical_id
    where prospect_id in (select id from public.prospects where _prospect_norm_name(company) = r.nm and _prospect_norm_city(city) = r.ct and organization_id = r.organization_id and id <> canonical_id);

    update public.prospects set merged_into = canonical_id
    where _prospect_norm_name(company) = r.nm and _prospect_norm_city(city) = r.ct and organization_id = r.organization_id and id <> canonical_id and merged_into is null;
  end loop;
end $$;

-- 4. Índice único para impedir novas duplicatas por CNPJ dentro da org
drop index if exists idx_prospects_unique_cnpj_org;
create unique index idx_prospects_unique_cnpj_org
on public.prospects (organization_id, _prospect_norm_cnpj(cnpj))
where merged_into is null and length(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g')) >= 8;

commit;