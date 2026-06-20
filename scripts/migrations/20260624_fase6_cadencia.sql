-- ============================================================
-- FASE 6: Cadência comercial + dashboard executivo
-- - Campos de cadência em public.prospects
-- - Tabela public.prospect_touchpoints (+ RLS + trigger)
-- - Flags is_meeting / is_proposal em public.deal_stages
-- - RPC public.dashboard_metrics()  (1 chamada agrega tudo)
-- - RPC public.acoes_hoje(int)      (lista de próximas ações)
-- - RPC public.snooze_prospect(uuid,int)
-- - RPC public.close_cadence(uuid,text,text)
-- Aplique no SQL Editor do Supabase.
-- ============================================================

-- 1) Cadência em prospects --------------------------------------------------
alter table public.prospects
  add column if not exists cadence_step    smallint    not null default 0,
  add column if not exists cadence_status  text        not null default 'ativo',
  add column if not exists response_status text        not null default 'sem_resposta',
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_contact_at timestamptz,
  add column if not exists closed_reason   text,
  add column if not exists closed_at       timestamptz;

do $$ begin
  alter table public.prospects
    add constraint prospects_cadence_step_chk    check (cadence_step between 0 and 6);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.prospects
    add constraint prospects_cadence_status_chk  check (cadence_status in ('ativo','pausado','encerrado'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.prospects
    add constraint prospects_response_status_chk check (response_status in
      ('sem_resposta','respondeu','interessado','sem_interesse','cliente'));
exception when duplicate_object then null; end $$;

create index if not exists prospects_next_contact_idx on public.prospects (user_id, next_contact_at);
create index if not exists prospects_response_idx     on public.prospects (user_id, response_status);
create index if not exists prospects_cadence_idx      on public.prospects (user_id, cadence_status);

-- 2) prospect_touchpoints ---------------------------------------------------
create table if not exists public.prospect_touchpoints (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('whatsapp','ligacao','email','reuniao','nota')),
  mensagem    text,
  resultado   text not null default 'enviado'
              check (resultado in ('enviado','respondido','interessado','sem_interesse','sem_resposta')),
  enviado_em  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.prospect_touchpoints to authenticated;
grant all                            on public.prospect_touchpoints to service_role;

alter table public.prospect_touchpoints enable row level security;

drop policy if exists "touchpoints owner read"   on public.prospect_touchpoints;
drop policy if exists "touchpoints owner insert" on public.prospect_touchpoints;
drop policy if exists "touchpoints owner update" on public.prospect_touchpoints;
drop policy if exists "touchpoints owner delete" on public.prospect_touchpoints;

create policy "touchpoints owner read"   on public.prospect_touchpoints
  for select to authenticated using (user_id = auth.uid());
create policy "touchpoints owner insert" on public.prospect_touchpoints
  for insert to authenticated with check (user_id = auth.uid());
create policy "touchpoints owner update" on public.prospect_touchpoints
  for update to authenticated using (user_id = auth.uid());
create policy "touchpoints owner delete" on public.prospect_touchpoints
  for delete to authenticated using (user_id = auth.uid());

create index if not exists prospect_touchpoints_prospect_idx
  on public.prospect_touchpoints (prospect_id, enviado_em desc);
create index if not exists prospect_touchpoints_user_idx
  on public.prospect_touchpoints (user_id, enviado_em desc);

-- 3) Trigger: avanço automático de cadência ---------------------------------
create or replace function public.advance_prospect_cadence()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  intervals int[] := array[1,3,7,15,21];  -- D+1, D+3, D+7, D+15, D+21
  cur_step smallint;
  nxt_step smallint;
  nxt_at   timestamptz;
  new_resp text;
  new_cad  text;
begin
  select cadence_step into cur_step from prospects where id = new.prospect_id;

  -- nota não avança cadência
  if new.tipo = 'nota' then
    return new;
  end if;

  nxt_step := least(coalesce(cur_step,0) + 1, 6);

  -- regras de encerramento
  if new.resultado = 'sem_interesse' or nxt_step >= 6 then
    nxt_at := null;
    new_cad := 'encerrado';
  elsif new.resultado = 'interessado' then
    nxt_at := null;  -- aguarda ação humana
    new_cad := 'ativo';
  else
    nxt_at := new.enviado_em + (intervals[nxt_step] || ' days')::interval;
    new_cad := 'ativo';
  end if;

  new_resp := case new.resultado
    when 'respondido'    then 'respondeu'
    when 'interessado'   then 'interessado'
    when 'sem_interesse' then 'sem_interesse'
    else null
  end;

  update prospects set
    cadence_step    = nxt_step,
    cadence_status  = new_cad,
    last_contact_at = new.enviado_em,
    next_contact_at = nxt_at,
    response_status = coalesce(new_resp, response_status),
    closed_at       = case when new_cad = 'encerrado' then now() else closed_at end,
    closed_reason   = case when new.resultado = 'sem_interesse' then 'sem_interesse'
                           when nxt_step >= 6 then 'cadencia_concluida'
                           else closed_reason end,
    updated_at      = now()
  where id = new.prospect_id;

  return new;
end $$;

drop trigger if exists prospect_touchpoint_advance on public.prospect_touchpoints;
create trigger prospect_touchpoint_advance
  after insert on public.prospect_touchpoints
  for each row execute function public.advance_prospect_cadence();

-- 4) Flags em deal_stages (elimina strings mágicas) ------------------------
alter table public.deal_stages
  add column if not exists is_meeting  boolean not null default false,
  add column if not exists is_proposal boolean not null default false;

update public.deal_stages set is_meeting  = true where id in ('reuniao','apresentacao');
update public.deal_stages set is_proposal = true where id in ('proposta','negociacao');

-- 5) RPC dashboard_metrics() -----------------------------------------------
create or replace function public.dashboard_metrics()
returns jsonb language sql stable security definer set search_path = public as $$
  with
  p as (select * from prospects where user_id = auth.uid()),
  t as (select * from prospect_touchpoints where user_id = auth.uid()),
  d as (
    select d.*, s.is_won, s.is_lost, s.is_meeting, s.is_proposal
    from deals d
    left join deal_stages s on s.id = d.stage_id
    where d.user_id = auth.uid()
  )
  select jsonb_build_object(
    'operacao', jsonb_build_object(
      'base',         (select count(*) from p),
      'contatadas',   (select count(*) from p where last_contact_at is not null),
      'sem_resposta', (select count(*) from p where response_status = 'sem_resposta' and last_contact_at is not null),
      'interessadas', (select count(*) from p where response_status in ('interessado','cliente')),
      'clientes',     (select count(*) from p where response_status = 'cliente')
    ),
    'cadencia', jsonb_build_object(
      'hoje',   (select count(*) from t where enviado_em >= date_trunc('day',   now())),
      'semana', (select count(*) from t where enviado_em >= date_trunc('week',  now())),
      'mes',    (select count(*) from t where enviado_em >= date_trunc('month', now())),
      'taxa_resposta',   coalesce((select round(100.0 * count(*) filter (where response_status <> 'sem_resposta')
                                                 / nullif(count(*),0), 1)
                                    from p where last_contact_at is not null), 0),
      'taxa_interesse',  coalesce((select round(100.0 * count(*) filter (where response_status in ('interessado','cliente'))
                                                 / nullif(count(*),0), 1)
                                    from p where last_contact_at is not null), 0),
      'taxa_fechamento', coalesce((select round(100.0 * count(*) filter (where response_status = 'cliente')
                                                 / nullif(count(*),0), 1)
                                    from p), 0)
    ),
    'gargalos', jsonb_build_object(
      'atrasados',         (select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'parados_30d',       (select count(*) from p where last_contact_at < now() - interval '30 days'),
      'sem_responsavel',   (select count(*) from p where coalesce(nullif(owner_name,''), null) is null),
      'deals_paradas_15d', (select count(*) from d where updated_at < now() - interval '15 days'
                                                      and coalesce(is_won,false) = false
                                                      and coalesce(is_lost,false) = false)
    ),
    'conversao', jsonb_build_object(
      'base_contato',
        coalesce((select round(100.0*count(*) filter (where last_contact_at is not null)
                              / nullif(count(*),0),1) from p), 0),
      'contato_interesse',
        coalesce((select round(100.0*count(*) filter (where response_status in ('interessado','cliente'))
                              / nullif(count(*),0),1) from p where last_contact_at is not null), 0),
      'interesse_reuniao',
        coalesce((select round(100.0*count(*) filter (where is_meeting = true)
                              / nullif(count(*),0),1) from d), 0),
      'reuniao_proposta',
        coalesce((select round(100.0*count(*) filter (where is_proposal = true)
                              / nullif(count(*) filter (where is_meeting = true),0),1) from d), 0),
      'proposta_cliente',
        coalesce((select round(100.0*count(*) filter (where coalesce(is_won,false) = true)
                              / nullif(count(*) filter (where is_proposal = true),0),1) from d), 0)
    ),
    'filtros', jsonb_build_object(
      'hoje',         (select count(*) from p where cadence_status='ativo' and next_contact_at::date = current_date),
      'atrasados',    (select count(*) from p where cadence_status='ativo' and next_contact_at < now()),
      'sem_resposta', (select count(*) from p where response_status='sem_resposta' and last_contact_at is not null),
      'responderam',  (select count(*) from p where response_status in ('respondeu','interessado','cliente')),
      'interessados', (select count(*) from p where response_status='interessado'),
      'clientes',     (select count(*) from p where response_status='cliente')
    )
  );
$$;

grant execute on function public.dashboard_metrics() to authenticated;

-- 6) RPC acoes_hoje(limit) -------------------------------------------------
create or replace function public.acoes_hoje(_limit int default 100)
returns table (
  id uuid,
  company text,
  whatsapp text,
  cadence_step smallint,
  last_contact_at timestamptz,
  next_contact_at timestamptz,
  dias_atraso int
)
language sql stable security definer set search_path = public as $$
  select
    id, company, whatsapp, cadence_step, last_contact_at, next_contact_at,
    case when next_contact_at < now()
         then greatest(0, floor(extract(epoch from (now() - next_contact_at))/86400)::int)
         else 0 end as dias_atraso
  from prospects
  where user_id = auth.uid()
    and cadence_status = 'ativo'
    and next_contact_at is not null
    and next_contact_at <= (current_date + interval '1 day')
  order by next_contact_at asc nulls last
  limit _limit;
$$;

grant execute on function public.acoes_hoje(int) to authenticated;

-- 7) RPC snooze_prospect ---------------------------------------------------
create or replace function public.snooze_prospect(_prospect_id uuid, _days int)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_next timestamptz;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  v_next := coalesce(
              (select next_contact_at from prospects where id = _prospect_id and user_id = v_uid),
              now()
            ) + (_days || ' days')::interval;
  update prospects
     set next_contact_at = v_next,
         cadence_status  = 'ativo',
         updated_at      = now()
   where id = _prospect_id and user_id = v_uid;
  return v_next;
end $$;

grant execute on function public.snooze_prospect(uuid, int) to authenticated;

-- 8) RPC close_cadence -----------------------------------------------------
create or replace function public.close_cadence(_prospect_id uuid, _reason text, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if _reason not in ('sem_interesse','numero_invalido','empresa_fechada','cliente','outro') then
    raise exception 'reason_invalido: %', _reason;
  end if;

  update prospects set
    cadence_status  = 'encerrado',
    cadence_step    = 6,
    next_contact_at = null,
    closed_at       = now(),
    closed_reason   = _reason,
    response_status = case when _reason = 'cliente' then 'cliente'
                           when _reason = 'sem_interesse' then 'sem_interesse'
                           else response_status end,
    updated_at      = now()
  where id = _prospect_id and user_id = v_uid;

  insert into public.prospect_touchpoints(prospect_id, user_id, tipo, mensagem, resultado)
  values (_prospect_id, v_uid, 'nota',
          'Cadência encerrada: ' || _reason || coalesce(' — ' || _note, ''),
          case _reason when 'sem_interesse' then 'sem_interesse'
                       when 'cliente' then 'interessado'
                       else 'enviado' end);
end $$;

grant execute on function public.close_cadence(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';