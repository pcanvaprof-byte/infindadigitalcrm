-- Garante que tabelas-filhas de proposals herdem organization_id automaticamente.
-- Necessário porque RPCs públicas (decidir_proposta, register_view, etc.) rodam
-- com session anônima — não há current_org_id() para preencher a coluna.

create or replace function public._fill_org_from_proposal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    select p.organization_id into new.organization_id
    from public.proposals p
    where p.id = new.proposal_id;
  end if;
  return new;
end$$;

do $$
declare
  t text;
  child_tables text[] := array[
    'proposal_approvals',
    'proposal_events',
    'proposal_views',
    'proposal_sends',
    'proposal_versions',
    'proposal_items',
    'proposal_attachments',
    'proposal_commissions',
    'proposal_discount_logs',
    'proposal_item_decisions',
    'proposal_loss_reasons'
  ];
begin
  foreach t in array child_tables loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists fill_org_from_proposal on public.%I', t);
      execute format(
        'create trigger fill_org_from_proposal before insert on public.%I
         for each row execute function public._fill_org_from_proposal()', t);
    end if;
  end loop;
end$$;

-- Backfill defensivo: se algum registro órfão ficou sem org_id, herda da proposta
update public.proposal_approvals a
   set organization_id = p.organization_id
  from public.proposals p
 where a.proposal_id = p.id and a.organization_id is null;