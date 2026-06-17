-- Briefings: suporte a Briefing Comercial + Kickoff de Produção (engine única)
-- Execute este script no SQL Editor do seu Supabase.

-- 1. Colunas novas
alter table public.briefings
  add column if not exists tipo text not null default 'briefing_comercial';

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='briefings' and constraint_name='briefings_tipo_check'
  ) then
    alter table public.briefings
      add constraint briefings_tipo_check
      check (tipo in ('briefing_comercial','kickoff_producao'));
  end if;
end $$;

alter table public.briefings
  add column if not exists lead_id uuid null references public.prospects(id) on delete set null;

create index if not exists idx_briefings_tipo_status
  on public.briefings(user_id, tipo, status);

create index if not exists idx_briefings_lead on public.briefings(lead_id);

-- 2. RPC pública atualizada (inclui tipo + lead_id + contato completo)
drop function if exists public.get_briefing_by_token(text);
create or replace function public.get_briefing_by_token(p_token text)
returns table (
  id uuid,
  tipo text,
  lead_id uuid,
  cliente_nome text,
  empresa text,
  telefone text,
  email text,
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
  select id, tipo, lead_id, cliente_nome, empresa, telefone, email,
         servico, status, respostas_json, token_publico, created_at, updated_at
    from public.briefings
   where token_publico = p_token
   limit 1;
$$;
grant execute on function public.get_briefing_by_token(text) to anon, authenticated;

-- 3. Storage bucket privado para uploads do kickoff
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kickoff-uploads',
  'kickoff-uploads',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png','image/jpeg','image/webp',
    'application/zip','application/x-zip-compressed',
    'video/mp4'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kickoff service all" on storage.objects;
create policy "kickoff service all" on storage.objects
  for all to service_role
  using (bucket_id = 'kickoff-uploads')
  with check (bucket_id = 'kickoff-uploads');

drop policy if exists "kickoff owner read" on storage.objects;
create policy "kickoff owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kickoff-uploads'
    and exists (
      select 1 from public.briefings b
      where b.user_id = auth.uid()
        and b.token_publico = split_part(name, '/', 1)
    )
  );

-- 4. Helpers RPC para automações pós-conclusão
create or replace function public.set_briefing_lead_status(p_token text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_lead uuid;
begin
  select lead_id into v_lead from public.briefings where token_publico = p_token limit 1;
  if v_lead is not null then
    update public.prospects set status = p_status, updated_at = now() where id = v_lead;
  end if;
end;
$$;
grant execute on function public.set_briefing_lead_status(text, text) to authenticated, service_role;

create or replace function public.log_briefing_activity(p_token text, p_kind text, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_lead uuid; v_user uuid;
begin
  select lead_id, user_id into v_lead, v_user from public.briefings where token_publico = p_token limit 1;
  if v_lead is not null and v_user is not null then
    insert into public.prospect_interactions(prospect_id, user_id, kind, text, by_name)
    values (v_lead, v_user, p_kind, p_text, 'Briefing/Kickoff');
  end if;
end;
$$;
grant execute on function public.log_briefing_activity(text, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';