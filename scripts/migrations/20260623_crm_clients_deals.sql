-- ============================================================
-- FASE 5A: CRM persistido — clients, deals, deal_stages, deal_activities
-- + RPC convert_prospect_to_client (idempotente, sem duplicação).
-- Aplique no SQL Editor do Supabase.
-- ============================================================

-- 1) Stages catalog ---------------------------------------------------------
create table if not exists public.deal_stages (
  id text primary key,
  label text not null,
  tone text,
  position int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false
);

grant select on public.deal_stages to anon, authenticated;
grant all on public.deal_stages to service_role;

alter table public.deal_stages enable row level security;
drop policy if exists "deal_stages public read" on public.deal_stages;
create policy "deal_stages public read" on public.deal_stages
  for select to anon, authenticated using (true);

insert into public.deal_stages (id, label, tone, position, is_won, is_lost) values
  ('lead',        'Lead',           'oklch(0.7 0.04 250)',  1, false, false),
  ('contato',     'Contato Feito',  'oklch(0.72 0.12 220)', 2, false, false),
  ('qualificado', 'Qualificado',    'oklch(0.72 0.14 200)', 3, false, false),
  ('apresentacao','Apresentação',   'oklch(0.7 0.18 264)',  4, false, false),
  ('reuniao',     'Reunião',        'oklch(0.72 0.18 290)', 5, false, false),
  ('proposta',    'Proposta',       'oklch(0.78 0.16 75)',  6, false, false),
  ('negociacao',  'Negociação',     'oklch(0.72 0.18 35)',  7, false, false),
  ('fechado',     'Fechado',        'oklch(0.7 0.17 158)',  8, true,  false),
  ('perdido',     'Perdido',        'oklch(0.62 0.15 25)',  9, false, true)
on conflict (id) do update
  set label = excluded.label,
      tone = excluded.tone,
      position = excluded.position,
      is_won = excluded.is_won,
      is_lost = excluded.is_lost;

-- 2) Clients ----------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid unique references public.prospects(id) on delete set null,
  company text not null,
  cnpj text,
  segment text,
  contact_name text,
  whatsapp text,
  phone text,
  email text,
  instagram text,
  city text,
  state text,
  owner_name text,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clients_user_cnpj_uniq
  on public.clients(user_id, cnpj) where cnpj is not null and cnpj <> '';
create index if not exists clients_user_idx on public.clients(user_id);

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;

alter table public.clients enable row level security;
drop policy if exists "clients owner all" on public.clients;
create policy "clients owner all" on public.clients
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Deals ------------------------------------------------------------------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete set null,
  title text not null,
  value numeric(14,2) not null default 0,
  stage_id text not null references public.deal_stages(id) default 'lead',
  owner_name text,
  expected_close date,
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_user_idx on public.deals(user_id);
create index if not exists deals_client_idx on public.deals(client_id);
create index if not exists deals_stage_idx on public.deals(user_id, stage_id);

grant select, insert, update, delete on public.deals to authenticated;
grant all on public.deals to service_role;

alter table public.deals enable row level security;
drop policy if exists "deals owner all" on public.deals;
create policy "deals owner all" on public.deals
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4) Deal activities --------------------------------------------------------
create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind text not null,
  text text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deal_activities_deal_idx
  on public.deal_activities(deal_id, created_at desc);

grant select, insert, update, delete on public.deal_activities to authenticated;
grant all on public.deal_activities to service_role;

alter table public.deal_activities enable row level security;
drop policy if exists "deal_activities owner all" on public.deal_activities;
create policy "deal_activities owner all" on public.deal_activities
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5) Triggers de updated_at -------------------------------------------------
create or replace function public._infinda_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function public._infinda_touch_updated_at();

drop trigger if exists deals_touch on public.deals;
create trigger deals_touch before update on public.deals
  for each row execute function public._infinda_touch_updated_at();

-- 6) Trigger: log automático de mudança de estágio --------------------------
create or replace function public._infinda_log_deal_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    insert into public.deal_activities(user_id, deal_id, kind, text, meta)
    values (
      new.user_id, new.id, 'stage_change',
      format('Estágio: %s → %s', old.stage_id, new.stage_id),
      jsonb_build_object('from', old.stage_id, 'to', new.stage_id)
    );
    -- marca fechamento quando entra em estágio is_won/is_lost
    if exists (select 1 from public.deal_stages s
                where s.id = new.stage_id and (s.is_won or s.is_lost))
    then
      new.closed_at = coalesce(new.closed_at, now());
    else
      new.closed_at = null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists deals_stage_log on public.deals;
create trigger deals_stage_log before update on public.deals
  for each row execute function public._infinda_log_deal_stage();

-- 7) RPC convert_prospect_to_client ----------------------------------------
-- Idempotente: se já existe client para o prospect, devolve o existente.
-- Cria também um deal inicial em 'lead' (a menos que já exista deal aberto).
drop function if exists public.convert_prospect_to_client(uuid, numeric, text);
create or replace function public.convert_prospect_to_client(
  p_prospect_id uuid,
  p_deal_value numeric default 0,
  p_deal_title text default null
) returns table (client_id uuid, deal_id uuid, created boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prospect public.prospects;
  v_client public.clients;
  v_deal public.deals;
  v_created boolean := false;
begin
  if v_uid is null then raise exception 'auth_required'; end if;

  select * into v_prospect from public.prospects
    where id = p_prospect_id and user_id = v_uid;
  if not found then raise exception 'prospect_not_found'; end if;

  -- 1. client (idempotente por prospect_id; também tenta match por CNPJ)
  select * into v_client from public.clients
    where user_id = v_uid
      and (prospect_id = p_prospect_id
           or (v_prospect.cnpj is not null and v_prospect.cnpj <> '' and cnpj = v_prospect.cnpj))
    limit 1;

  if not found then
    insert into public.clients(
      user_id, prospect_id, company, cnpj, segment, contact_name,
      whatsapp, phone, email, instagram, city, state, owner_name, notes
    ) values (
      v_uid, v_prospect.id, v_prospect.company, nullif(v_prospect.cnpj,''),
      v_prospect.segment, v_prospect.owner_name,
      v_prospect.whatsapp, v_prospect.phone, v_prospect.email, v_prospect.instagram,
      v_prospect.city, v_prospect.state, v_prospect.owner_name,
      'Convertido do prospect em ' || to_char(now(),'DD/MM/YYYY HH24:MI')
    ) returning * into v_client;
    v_created := true;
  else
    -- preenche campos vazios sem sobrescrever
    update public.clients set
      prospect_id  = coalesce(prospect_id, v_prospect.id),
      cnpj         = coalesce(nullif(cnpj,''), nullif(v_prospect.cnpj,'')),
      segment      = coalesce(nullif(segment,''), v_prospect.segment),
      contact_name = coalesce(nullif(contact_name,''), v_prospect.owner_name),
      whatsapp     = coalesce(nullif(whatsapp,''), v_prospect.whatsapp),
      phone        = coalesce(nullif(phone,''), v_prospect.phone),
      email        = coalesce(nullif(email,''), v_prospect.email),
      instagram    = coalesce(nullif(instagram,''), v_prospect.instagram),
      city         = coalesce(nullif(city,''), v_prospect.city),
      state        = coalesce(nullif(state,''), v_prospect.state),
      owner_name   = coalesce(nullif(owner_name,''), v_prospect.owner_name)
    where id = v_client.id
    returning * into v_client;
  end if;

  -- 2. deal: 1 aberto por client; reaproveita se já existir
  select * into v_deal from public.deals
    where user_id = v_uid and client_id = v_client.id and closed_at is null
    order by created_at desc limit 1;

  if not found then
    insert into public.deals(
      user_id, client_id, prospect_id, title, value, stage_id, owner_name
    ) values (
      v_uid, v_client.id, v_prospect.id,
      coalesce(p_deal_title, v_prospect.company),
      coalesce(p_deal_value, 0),
      'lead', v_prospect.owner_name
    ) returning * into v_deal;

    insert into public.deal_activities(user_id, deal_id, kind, text)
    values (v_uid, v_deal.id, 'note',
      'Deal criado a partir do prospect ' || v_prospect.company);
  end if;

  -- 3. status do prospect → 'cliente'
  update public.prospects
     set status = 'cliente', updated_at = now()
   where id = v_prospect.id;

  -- 4. histórico no prospect (compatível com prospect_interactions)
  insert into public.prospect_interactions(prospect_id, user_id, kind, text, by_name)
  values (v_prospect.id, v_uid, 'nota',
    case when v_created then 'Convertido em cliente' else 'Cliente já existia — vínculo reforçado' end,
    'Sistema');

  return query select v_client.id, v_deal.id, v_created;
end $$;

grant execute on function public.convert_prospect_to_client(uuid, numeric, text) to authenticated;

-- 8) Vínculo opcional briefings ↔ clients ----------------------------------
alter table public.briefings
  add column if not exists client_id uuid references public.clients(id) on delete set null;
create index if not exists briefings_client_idx on public.briefings(client_id);

-- 9) Realtime (Fase 5D usará) ----------------------------------------------
do $$ begin
  perform 1 from pg_publication where pubname='supabase_realtime';
  if found then
    execute 'alter publication supabase_realtime add table public.clients';
    execute 'alter publication supabase_realtime add table public.deals';
    execute 'alter publication supabase_realtime add table public.deal_activities';
  end if;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';