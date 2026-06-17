-- ============================================================
-- HOTFIX: remove dependência de gen_random_bytes/pgcrypto no auto-Kickoff
-- Execute este arquivo inteiro no SQL Editor do Supabase externo.
-- ============================================================

drop trigger if exists trg_infinda_prospect_status on public.prospects;
drop function if exists public._infinda_on_prospect_status_change();

create or replace function public._infinda_on_prospect_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_has_kickoff boolean;
begin
  if new.status is distinct from old.status and new.status = 'fechado_ganho' then
    select exists(
      select 1
        from public.briefings
       where lead_id = new.id
         and tipo = 'kickoff_producao'
         and status <> 'cancelado'
    ) into v_has_kickoff;

    if not v_has_kickoff then
      v_token := md5(random()::text || clock_timestamp()::text || new.id::text)
              || md5(random()::text || clock_timestamp()::text || coalesce(new.email, ''));

      insert into public.briefings(
        user_id, tipo, lead_id, cliente_nome, empresa, telefone, email,
        servico, status, token_publico, respostas_json
      ) values (
        new.user_id, 'kickoff_producao', new.id,
        new.owner_name, new.company, new.phone, new.email,
        'gestao_trafego', 'pendente', v_token, '{}'::jsonb
      );

      perform public._infinda_log_activity(
        new.id,
        new.user_id,
        'nota',
        'Kickoff de Produção criado automaticamente — envie o link ao cliente.'
      );

      new.status := 'aguardando_kickoff';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_infinda_prospect_status
  before update on public.prospects
  for each row execute function public._infinda_on_prospect_status_change();

notify pgrst, 'reload schema';