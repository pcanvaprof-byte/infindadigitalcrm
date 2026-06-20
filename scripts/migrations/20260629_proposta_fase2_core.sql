-- ============================================================
-- INFINDA — Propostas Fase 2 (aditivo)
-- Schema premium: decisões por item, descontos, perdas estruturadas,
-- anexos, snapshot financeiro imutável, auditoria, comissões.
-- Respeita Event Boundary Document (docs/architecture/event-boundaries.md).
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin
  create type public.proposal_loss_reason as enum
    ('preco','concorrente','sem_orcamento','timing','desistencia','outros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.proposal_item_decision as enum ('aceito','recusado','pendente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.financeiro_tipo as enum ('implantacao','mrr','avulso');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_action as enum ('insert','update','delete');
exception when duplicate_object then null; end $$;

-- ---------- proposals: papéis comerciais ----------
alter table public.proposals
  add column if not exists closer_id    uuid references auth.users(id) on delete set null,
  add column if not exists consultor_id uuid references auth.users(id) on delete set null;

create index if not exists proposals_closer_idx on public.proposals(closer_id);
create index if not exists proposals_consultor_idx on public.proposals(consultor_id);

-- ---------- proposal_versions: versão ativa única ----------
alter table public.proposal_versions
  add column if not exists is_active boolean not null default false;

create unique index if not exists proposal_versions_one_active
  on public.proposal_versions(proposal_id) where is_active;

-- ============================================================
-- 1) proposal_item_decisions  (aprovação por item, append-only)
-- ============================================================
create table if not exists public.proposal_item_decisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  item_id     uuid not null references public.proposal_items(id) on delete cascade,
  decisao     public.proposal_item_decision not null,
  cliente_nome  text,
  cliente_email text,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists proposal_item_decisions_prop_idx on public.proposal_item_decisions(proposal_id, created_at desc);
create index if not exists proposal_item_decisions_item_idx on public.proposal_item_decisions(item_id, created_at desc);

grant select, insert on public.proposal_item_decisions to authenticated;
grant all on public.proposal_item_decisions to service_role;
alter table public.proposal_item_decisions enable row level security;

drop policy if exists "pid owner select" on public.proposal_item_decisions;
create policy "pid owner select" on public.proposal_item_decisions
  for select to authenticated using (
    exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid())
  );

-- ============================================================
-- 2) proposal_discount_logs (todo desconto rastreado)
-- ============================================================
create table if not exists public.proposal_discount_logs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  item_id     uuid references public.proposal_items(id) on delete set null,
  valor_original numeric(12,2) not null,
  valor_final    numeric(12,2) not null,
  desconto_percentual numeric(6,2) generated always as (
    case when valor_original > 0
      then round(((valor_original - valor_final) / valor_original) * 100, 2)
      else 0 end
  ) stored,
  motivo text not null,
  solicitado_por uuid references auth.users(id) on delete set null,
  aprovado_por   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pdl_prop_idx on public.proposal_discount_logs(proposal_id, created_at desc);

grant select, insert on public.proposal_discount_logs to authenticated;
grant all on public.proposal_discount_logs to service_role;
alter table public.proposal_discount_logs enable row level security;

drop policy if exists "pdl owner" on public.proposal_discount_logs;
create policy "pdl owner" on public.proposal_discount_logs
  for all to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()));

-- ============================================================
-- 3) proposal_loss_reasons (motivo estruturado de perda)
-- ============================================================
create table if not exists public.proposal_loss_reasons (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  motivo public.proposal_loss_reason not null,
  concorrente text,
  observacao text,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists plr_one_per_proposal on public.proposal_loss_reasons(proposal_id);

grant select, insert, update on public.proposal_loss_reasons to authenticated;
grant all on public.proposal_loss_reasons to service_role;
alter table public.proposal_loss_reasons enable row level security;

drop policy if exists "plr owner" on public.proposal_loss_reasons;
create policy "plr owner" on public.proposal_loss_reasons
  for all to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()));

-- ============================================================
-- 4) proposal_attachments (documentos complementares)
-- ============================================================
create table if not exists public.proposal_attachments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  nome text not null,
  storage_path text not null,
  mime text,
  tamanho int,
  uploaded_by uuid references auth.users(id) on delete set null,
  visivel_cliente boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists pa_prop_idx on public.proposal_attachments(proposal_id);

grant select, insert, update, delete on public.proposal_attachments to authenticated;
grant all on public.proposal_attachments to service_role;
alter table public.proposal_attachments enable row level security;

drop policy if exists "pa owner" on public.proposal_attachments;
create policy "pa owner" on public.proposal_attachments
  for all to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()));

-- ============================================================
-- 5) financeiro_previsto (SNAPSHOT IMUTÁVEL por versão)
--    INSERT-only. Sem UPDATE/DELETE.
-- ============================================================
create table if not exists public.financeiro_previsto (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete cascade,
  tipo public.financeiro_tipo not null,
  valor numeric(12,2) not null,
  competencia date not null,
  created_at timestamptz not null default now()
);
create index if not exists fp_prop_idx on public.financeiro_previsto(proposal_id, competencia);
create index if not exists fp_version_idx on public.financeiro_previsto(proposal_version_id);

-- INSERT-only: revoga UPDATE/DELETE para authenticated
grant select, insert on public.financeiro_previsto to authenticated;
grant all on public.financeiro_previsto to service_role;
alter table public.financeiro_previsto enable row level security;

drop policy if exists "fp owner select" on public.financeiro_previsto;
create policy "fp owner select" on public.financeiro_previsto
  for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()));

drop policy if exists "fp owner insert" on public.financeiro_previsto;
create policy "fp owner insert" on public.financeiro_previsto
  for insert to authenticated
  with check (exists (select 1 from public.proposals p where p.id = proposal_id and p.user_id = auth.uid()));

-- Trigger anti-mutação (defesa em profundidade contra service_role acidental)
create or replace function public.tg_fp_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'financeiro_previsto é imutável (snapshot por versão)';
end $$;

drop trigger if exists tg_fp_no_update on public.financeiro_previsto;
create trigger tg_fp_no_update before update on public.financeiro_previsto
  for each row execute function public.tg_fp_immutable();

drop trigger if exists tg_fp_no_delete on public.financeiro_previsto;
create trigger tg_fp_no_delete before delete on public.financeiro_previsto
  for each row execute function public.tg_fp_immutable();

-- ============================================================
-- 6) audit_logs (estrutural, append-only, aud_*)
-- ============================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid,
  acao public.audit_action not null,
  antes jsonb,
  depois jsonb,
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_tabela_idx on public.audit_logs(tabela, created_at desc);
create index if not exists audit_logs_registro_idx on public.audit_logs(registro_id);

grant select, insert on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

drop policy if exists "audit owner select" on public.audit_logs;
create policy "audit owner select" on public.audit_logs
  for select to authenticated using (usuario_id = auth.uid());

-- Trigger genérico de auditoria estrutural
create or replace function public.tg_aud_capture() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(tabela, registro_id, acao, antes, depois, usuario_id)
  values (
    tg_table_name,
    coalesce((new).id, (old).id),
    lower(tg_op)::public.audit_action,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end $$;

drop trigger if exists tg_aud_proposals on public.proposals;
create trigger tg_aud_proposals after insert or update or delete on public.proposals
  for each row execute function public.tg_aud_capture();

drop trigger if exists tg_aud_proposal_items on public.proposal_items;
create trigger tg_aud_proposal_items after insert or update or delete on public.proposal_items
  for each row execute function public.tg_aud_capture();

drop trigger if exists tg_aud_proposal_discount_logs on public.proposal_discount_logs;
create trigger tg_aud_proposal_discount_logs after insert on public.proposal_discount_logs
  for each row execute function public.tg_aud_capture();

-- ============================================================
-- 7) Backfill: prefixar event_type com evt_
-- ============================================================
update public.proposal_events
   set tipo = 'evt_' || tipo
 where tipo !~ '^evt_';

-- ============================================================
-- 8) Helper log_evt — fonte única de eventos de negócio
-- ============================================================
create or replace function public.log_evt(
  p_proposal_id uuid,
  p_tipo text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_type text default 'system'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tipo text := case when p_tipo ~ '^evt_' then p_tipo else 'evt_' || p_tipo end;
begin
  insert into public.proposal_events(proposal_id, tipo, actor_id, actor_type, payload)
  values (p_proposal_id, v_tipo, auth.uid(), p_actor_type, coalesce(p_payload,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.log_evt(uuid, text, jsonb, text) to authenticated;

-- ============================================================
-- 9) View base — funil de propostas (usada pelo CRM desde o dia 1)
-- ============================================================
create or replace view public.vw_proposal_funnel as
select
  user_id,
  status,
  count(*) as total,
  sum(valor_implantacao + valor_mensal + valor_avulso) as valor_total
from public.proposals
group by user_id, status;

grant select on public.vw_proposal_funnel to authenticated;

-- ============================================================
-- 10) Anti-replay para evt_proposal_viewed
--    Dedupe por (proposta_id, hash(ip+ua+hora))
-- ============================================================
create or replace function public.register_proposal_view_safe(
  p_token text, p_ua text default null, p_ip text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_prop uuid; v_ver uuid; v_key text; v_already boolean;
begin
  select id, current_version_id into v_prop, v_ver
    from public.proposals where token_publico = p_token;
  if v_prop is null then return false; end if;

  v_key := md5(coalesce(p_ip,'') || '|' || coalesce(p_ua,'') || '|' ||
               to_char(date_trunc('hour', now()),'YYYYMMDDHH24'));

  select exists(
    select 1 from public.proposal_events
     where proposal_id = v_prop
       and tipo = 'evt_proposal_viewed'
       and payload->>'dedupe_key' = v_key
       and created_at > now() - interval '1 hour'
  ) into v_already;

  if v_already then return false; end if;

  insert into public.proposal_views(proposal_id, version_id, user_agent, referrer)
  values (v_prop, v_ver, p_ua, null);

  update public.proposals
     set first_viewed_at = coalesce(first_viewed_at, now()),
         status = case when status = 'enviada' then 'visualizada'::public.proposal_status else status end
   where id = v_prop;

  perform public.log_evt(v_prop, 'evt_proposal_viewed',
                         jsonb_build_object('ua', p_ua, 'dedupe_key', v_key),
                         'client');
  return true;
end $$;
grant execute on function public.register_proposal_view_safe(text, text, text) to anon, authenticated;

-- Reload PostgREST
notify pgrst, 'reload schema';
