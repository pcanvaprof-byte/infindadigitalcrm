-- Briefings Inteligentes — INFINDA Digital

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_nome text,
  empresa text,
  telefone text,
  email text,
  servico text not null check (servico in ('pagina_vendas','mentoria_trafego','gestao_trafego')),
  status text not null default 'pendente' check (status in ('pendente','em_preenchimento','concluido','cancelado')),
  token_publico text not null unique,
  respostas_json jsonb not null default '{}'::jsonb,
  resumo_ia text,
  responsavel text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.briefings to authenticated;
grant all on public.briefings to service_role;

alter table public.briefings enable row level security;

drop policy if exists "briefings owner all" on public.briefings;
create policy "briefings owner all" on public.briefings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_briefings_user on public.briefings(user_id);
create index if not exists idx_briefings_status on public.briefings(status);
create unique index if not exists idx_briefings_token on public.briefings(token_publico);

create or replace function public.briefings_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_briefings_updated_at on public.briefings;
create trigger trg_briefings_updated_at
  before update on public.briefings
  for each row execute function public.briefings_set_updated_at();

create or replace function public.get_briefing_by_token(p_token text)
returns table (
  id uuid,
  cliente_nome text,
  empresa text,
  servico text,
  status text,
  respostas_json jsonb,
  token_publico text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, cliente_nome, empresa, servico, status, respostas_json,
         token_publico, created_at, updated_at
    from public.briefings
   where token_publico = p_token
   limit 1;
$$;
grant execute on function public.get_briefing_by_token(text) to anon, authenticated;

create or replace function public.update_briefing_by_token(
  p_token text,
  p_respostas jsonb,
  p_status text default null
)
returns public.briefings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.briefings;
begin
  select * into v_row from public.briefings where token_publico = p_token limit 1;
  if not found then
    raise exception 'briefing_not_found';
  end if;
  if v_row.status = 'concluido' then
    return v_row;
  end if;
  update public.briefings
     set respostas_json = coalesce(p_respostas, respostas_json),
         status = case
                    when p_status in ('em_preenchimento','concluido') then p_status
                    else status
                  end
   where token_publico = p_token
   returning * into v_row;
  return v_row;
end;
$$;
grant execute on function public.update_briefing_by_token(text, jsonb, text) to anon, authenticated;

create or replace function public.set_briefing_resumo_ia(p_token text, p_resumo text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.briefings set resumo_ia = p_resumo where token_publico = p_token;
$$;
grant execute on function public.set_briefing_resumo_ia(text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
