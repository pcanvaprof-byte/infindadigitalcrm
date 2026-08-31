-- ============================================================
-- Integração Gmail OAuth: armazena tokens por usuário
-- ============================================================

create table if not exists public.gmail_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- RLS: cada usuário só vê/edita o próprio token
alter table public.gmail_oauth_tokens enable row level security;

create policy "usuario_le_proprio_token"
  on public.gmail_oauth_tokens for select
  using (auth.uid() = user_id);

create policy "usuario_insere_proprio_token"
  on public.gmail_oauth_tokens for insert
  with check (auth.uid() = user_id);

create policy "usuario_atualiza_proprio_token"
  on public.gmail_oauth_tokens for update
  using (auth.uid() = user_id);

create policy "usuario_deleta_proprio_token"
  on public.gmail_oauth_tokens for delete
  using (auth.uid() = user_id);

-- service_role precisa para as Edge Functions gravarem tokens
grant all on public.gmail_oauth_tokens to service_role;

-- Índice para busca por user_id
create index if not exists gmail_oauth_tokens_user_id_idx
  on public.gmail_oauth_tokens(user_id);

-- Trigger de updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gmail_oauth_tokens_updated_at
  before update on public.gmail_oauth_tokens
  for each row execute function public.set_updated_at();
