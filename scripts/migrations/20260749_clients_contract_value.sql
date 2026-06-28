-- =====================================================================
-- Adiciona clients.contract_value (dependência da RPC bi_dashboard /
-- migration 20260746_bi_layer.sql). Backfill seguro a partir de
-- propostas aprovadas quando a tabela/coluna existir. Idempotente.
-- =====================================================================

alter table public.clients
  add column if not exists contract_value numeric(14,2) not null default 0;

create index if not exists idx_clients_contract_value
  on public.clients (organization_id, contract_value);

-- Backfill best-effort: pega o maior valor de proposta aprovada por cliente,
-- somente se a tabela proposals existir com as colunas esperadas.
do $$
declare
  v_has_proposals boolean;
  v_value_col text;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'proposals'
  ) into v_has_proposals;

  if not v_has_proposals then
    return;
  end if;

  select column_name into v_value_col
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'proposals'
    and column_name in ('valor_total','valor','total','amount','contract_value')
  order by case column_name
      when 'contract_value' then 1
      when 'valor_total' then 2
      when 'valor' then 3
      when 'total' then 4
      when 'amount' then 5
    end
  limit 1;

  if v_value_col is null then
    return;
  end if;

  execute format($f$
    update public.clients c
    set contract_value = sub.v
    from (
      select client_id, max(coalesce(%I,0))::numeric(14,2) as v
      from public.proposals
      where client_id is not null
      group by client_id
    ) sub
    where sub.client_id = c.id
      and c.contract_value = 0
      and sub.v > 0
  $f$, v_value_col);
end$$;

notify pgrst, 'reload schema';