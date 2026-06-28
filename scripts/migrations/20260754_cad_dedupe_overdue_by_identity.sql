-- Dedupe focada nos leads ATRASADOS, agora por IDENTIDADE (CNPJ ou nome da
-- empresa normalizado) em vez de telefone. Telefone muda; CNPJ/empresa é o
-- que o usuário usa para identificar o cliente.
--
-- Estratégia:
--   1. cad_norm_empresa(): normaliza nome (lowercase, sem acentos, sem sufixos
--      societários, sem pontuação, espaços colapsados).
--   2. Agrupa atrasados por (organization_id, cnpj) quando cnpj válido;
--      caso contrário por (organization_id, empresa_norm).
--   3. Mantém o card no estágio mais avançado (cad_stage_rank) com tie-break
--      pelo next_action_at/created_at mais recente.
--   4. Reaproveita _cad_merge_losers_into() criado em 20260738 para migrar
--      mensagens/notificações antes do delete.
--
-- Idempotente. READ-ONLY até a chamada explícita da RPC no final.

-- 1) Normalizador de nome de empresa --------------------------------------
create or replace function public.cad_norm_empresa(p text)
returns text language sql immutable as $$
  with base as (
    select lower(coalesce(p,'')) as s
  ),
  no_accent as (
    select translate(s,
      'áàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
      'aaaaaaceeeeiiiinoooooouuuuyy') as s
    from base
  ),
  no_suffix as (
    -- remove sufixos societários comuns no final
    select regexp_replace(s,
      '\s+(ltda|me|epp|eireli|s/?a|sa|s\.a\.|cia|cia\.|mei|sociedade|sociedad)\s*\.?\s*$',
      '', 'g') as s
    from no_accent
  ),
  clean as (
    -- remove pontuação e colapsa espaços
    select btrim(regexp_replace(regexp_replace(s, '[^a-z0-9 ]+', ' ', 'g'),
                                '\s+', ' ', 'g')) as s
    from no_suffix
  )
  select nullif(s, '') from clean
$$;

-- 2) RPC de dedupe nos atrasados por identidade ---------------------------
create or replace function public.cad_admin_dedupe_overdue_by_identity()
returns table(criterio text, grupos int, removidos int)
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_winner uuid;
  v_losers uuid[];
  v_grupos_cnpj int := 0;
  v_rem_cnpj int := 0;
  v_grupos_emp int := 0;
  v_rem_emp int := 0;
begin
  -- 2a) por CNPJ (quando tiver 14 dígitos válidos)
  for r in
    with atrasados as (
      select id, organization_id, stage, next_action_at, created_at,
             nullif(regexp_replace(coalesce(cnpj,''), '\D', '', 'g'), '') as cnpj_d
      from public.cad_leads
      where next_action_at < now()
        and coalesce(stage::text,'') not in ('perdido','fechado','cliente')
    )
    select organization_id, cnpj_d, array_agg(id) as ids
    from atrasados
    where cnpj_d is not null and length(cnpj_d) = 14
    group by organization_id, cnpj_d
    having count(*) > 1
  loop
    select id into v_winner
    from public.cad_leads
    where id = any(r.ids)
    order by public.cad_stage_rank(stage::text) desc nulls last,
             coalesce(next_action_at, created_at) desc nulls last
    limit 1;

    v_losers := array(select unnest(r.ids) except select v_winner);
    if array_length(v_losers,1) is null then continue; end if;

    perform public._cad_merge_losers_into(v_winner, v_losers);
    delete from public.cad_leads where id = any(v_losers);

    v_grupos_cnpj := v_grupos_cnpj + 1;
    v_rem_cnpj := v_rem_cnpj + array_length(v_losers,1);
  end loop;

  -- 2b) por empresa normalizada (só quando NÃO há CNPJ válido para ancorar)
  for r in
    with atrasados as (
      select id, organization_id, stage, next_action_at, created_at,
             public.cad_norm_empresa(empresa) as emp_n,
             nullif(regexp_replace(coalesce(cnpj,''), '\D', '', 'g'), '') as cnpj_d
      from public.cad_leads
      where next_action_at < now()
        and coalesce(stage::text,'') not in ('perdido','fechado','cliente')
    )
    select organization_id, emp_n, array_agg(id) as ids
    from atrasados
    where emp_n is not null
      and (cnpj_d is null or length(cnpj_d) <> 14)
    group by organization_id, emp_n
    having count(*) > 1
  loop
    select id into v_winner
    from public.cad_leads
    where id = any(r.ids)
    order by public.cad_stage_rank(stage::text) desc nulls last,
             coalesce(next_action_at, created_at) desc nulls last
    limit 1;

    v_losers := array(select unnest(r.ids) except select v_winner);
    if array_length(v_losers,1) is null then continue; end if;

    perform public._cad_merge_losers_into(v_winner, v_losers);
    delete from public.cad_leads where id = any(v_losers);

    v_grupos_emp := v_grupos_emp + 1;
    v_rem_emp := v_rem_emp + array_length(v_losers,1);
  end loop;

  return query
    select 'cnpj'::text, v_grupos_cnpj, v_rem_cnpj
    union all
    select 'empresa'::text, v_grupos_emp, v_rem_emp;
end$$;

grant execute on function public.cad_admin_dedupe_overdue_by_identity()
  to authenticated, service_role;

-- 3) Executa imediatamente
select * from public.cad_admin_dedupe_overdue_by_identity();

-- 4) Conferência pós-execução: deve retornar 0 linhas
with atrasados as (
  select id, organization_id, stage,
         public.cad_norm_empresa(empresa) as emp_n,
         nullif(regexp_replace(coalesce(cnpj,''), '\D', '', 'g'), '') as cnpj_d
  from public.cad_leads
  where next_action_at < now()
    and coalesce(stage::text,'') not in ('perdido','fechado','cliente')
)
select 'cnpj' as criterio, organization_id, cnpj_d as chave, count(*) as cards,
       array_agg(id) as ids
from atrasados
where cnpj_d is not null and length(cnpj_d) = 14
group by organization_id, cnpj_d
having count(*) > 1
union all
select 'empresa', organization_id, emp_n, count(*), array_agg(id)
from atrasados
where emp_n is not null
  and (cnpj_d is null or length(cnpj_d) <> 14)
group by organization_id, emp_n
having count(*) > 1
order by cards desc;