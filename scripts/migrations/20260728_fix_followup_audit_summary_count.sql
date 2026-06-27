-- ============================================================================
-- Fix: cad_followup_audit_summary estava capando qtd em 5 por bucket porque
-- o filtro `rn <= 5` (usado para limitar EXEMPLOS) era aplicado antes do
-- count(*). Resultado: 412 leads na base mas summary mostrava só 15.
--
-- Correção: separar a contagem real (count sobre a view inteira) do
-- agregado de exemplos (limitado a 5 nomes via subquery).
-- ============================================================================

create or replace function public.cad_followup_audit_summary(p_org uuid default null)
returns table (bucket text, qtd bigint, exemplo_empresas text)
language sql security definer set search_path = public as $$
  with all_rows as (
    select bucket, empresa, created_at
      from public.cad_followup_audit
     where (p_org is null or organization_id = p_org)
  ),
  counts as (
    select bucket, count(*) as qtd
      from all_rows
     group by bucket
  ),
  samples as (
    select bucket,
           string_agg(empresa, ', ' order by created_at desc)
             filter (where empresa is not null) as exemplo_empresas
      from (
        select bucket, empresa, created_at,
               row_number() over (partition by bucket order by created_at desc) as rn
          from all_rows
      ) s
     where rn <= 5
     group by bucket
  )
  select c.bucket, c.qtd, s.exemplo_empresas
    from counts c
    left join samples s using (bucket)
   order by c.qtd desc;
$$;

grant execute on function public.cad_followup_audit_summary(uuid) to authenticated;