-- =====================================================================
-- Cadência: auditoria + deduplicação de cards duplicados
-- =====================================================================
-- Causas conhecidas de duplicidade:
--   1) Leads criados manualmente (sem prospect_id) que depois foram também
--      importados via cad_import_from_prospects (com prospect_id).
--   2) Dois prospects diferentes para a mesma empresa+telefone, gerando
--      dois leads distintos.
--   3) Leads inseridos antes de existir o índice unique em prospect_id.
--
-- Estratégia:
--   - Manter o lead "vencedor" (mais antigo, ou o que tem mais histórico).
--   - Repontar cad_messages dos perdedores para o vencedor.
--   - Excluir os perdedores.
--   - Reforçar índices únicos.
-- =====================================================================

-- 1) AUDITORIA — view para inspecionar duplicatas atuais
create or replace view public.cad_leads_duplicates_v as
with norm as (
  select
    id,
    organization_id,
    prospect_id,
    coalesce(nullif(trim(empresa), ''), 'Sem nome') as empresa_norm,
    regexp_replace(coalesce(whatsapp, telefone, ''), '\D', '', 'g') as fone_norm,
    last_contact_at,
    created_at
  from public.cad_leads
),
keys as (
  select
    id,
    organization_id,
    case
      when prospect_id is not null then 'prospect:' || prospect_id::text
      when fone_norm <> '' then 'fone:' || fone_norm
      else 'empresa:' || lower(empresa_norm)
    end as dedup_key,
    last_contact_at,
    created_at
  from norm
)
select
  organization_id,
  dedup_key,
  count(*) as total,
  array_agg(id order by created_at) as lead_ids
from keys
group by organization_id, dedup_key
having count(*) > 1;

grant select on public.cad_leads_duplicates_v to authenticated, service_role;

-- 2) FUNÇÃO DE MERGE — escolhe o "vencedor" e mescla histórico
create or replace function public.cad_admin_dedupe_leads()
returns table (merged int, removed int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged int := 0;
  v_removed int := 0;
  r record;
  v_winner uuid;
  v_losers uuid[];
begin
  for r in
    select organization_id, dedup_key, lead_ids
      from public.cad_leads_duplicates_v
  loop
    -- Vencedor: o mais antigo COM último contato; senão o mais antigo.
    select id into v_winner
      from public.cad_leads
     where id = any(r.lead_ids)
     order by (last_contact_at is null) asc, created_at asc
     limit 1;

    if v_winner is null then continue; end if;

    v_losers := array(
      select id from unnest(r.lead_ids) as id where id <> v_winner
    );
    if array_length(v_losers, 1) is null then continue; end if;

    -- Repontar mensagens dos perdedores para o vencedor
    update public.cad_messages
       set lead_id = v_winner
     where lead_id = any(v_losers);

    -- Repontar notificações se existirem
    begin
      update public.cad_notifications
         set lead_id = v_winner
       where lead_id = any(v_losers);
    exception when undefined_table then null;
    end;

    -- Apagar perdedores
    delete from public.cad_leads where id = any(v_losers);

    v_merged := v_merged + 1;
    v_removed := v_removed + array_length(v_losers, 1);
  end loop;

  merged := v_merged;
  removed := v_removed;
  return next;
end;
$$;

grant execute on function public.cad_admin_dedupe_leads() to authenticated, service_role;
