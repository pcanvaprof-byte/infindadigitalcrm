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

-- ============================================================
-- Auto-cria contrato em "aguardando_formalizacao" quando a proposta é aprovada
-- via fluxo público (cliente assinando pelo token). Idempotente.
-- ============================================================
create or replace function public._criar_contrato_internal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user uuid;
  v_org uuid;
  v_implantacao numeric;
  v_mensal numeric;
  v_seq int;
  v_numero text;
begin
  select id into v_id from public.contratos where proposal_id = p_proposal_id;
  if v_id is not null then return v_id; end if;

  select user_id, organization_id, valor_implantacao, valor_mensal
    into v_user, v_org, v_implantacao, v_mensal
    from public.proposals where id = p_proposal_id;

  if v_user is null then return null; end if;

  select coalesce(max(substring(numero from '(\d+)$')::int), 0) + 1 into v_seq
    from public.contratos
   where numero like 'CTR-' || to_char(now(),'YYYY') || '-%';

  v_numero := 'CTR-' || to_char(now(),'YYYY') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.contratos(
    user_id, organization_id, proposal_id, numero, status,
    valor_implantacao, valor_mensal
  ) values (
    v_user, v_org, p_proposal_id, v_numero, 'aguardando_formalizacao',
    coalesce(v_implantacao, 0), coalesce(v_mensal, 0)
  ) returning id into v_id;

  insert into public.contrato_eventos(contrato_id, tipo, actor_type)
  values (v_id, 'evt_contrato_criado', 'system');

  return v_id;
end$$;

-- Hook: dispara após aprovação registrada em proposal_approvals
create or replace function public._on_proposal_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.decisao = 'aprovada' then
    perform public._criar_contrato_internal(new.proposal_id);
  end if;
  return new;
end$$;

drop trigger if exists auto_create_contrato on public.proposal_approvals;
create trigger auto_create_contrato
after insert on public.proposal_approvals
for each row execute function public._on_proposal_approved();

-- Backfill: criar contratos para propostas já aprovadas que ainda não têm contrato
do $$
declare r record;
begin
  for r in
    select p.id from public.proposals p
    left join public.contratos c on c.proposal_id = p.id
    where p.status in ('aprovada','convertida') and c.id is null
  loop
    perform public._criar_contrato_internal(r.id);
  end loop;
end$$;