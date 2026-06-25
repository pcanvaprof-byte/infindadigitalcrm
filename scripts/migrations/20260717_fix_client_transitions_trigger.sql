-- Fix: BEFORE INSERT trigger tentava inserir em client_transitions antes da linha
-- de clients existir, violando a FK. Separamos em BEFORE UPDATE (mantém guard rails
-- que mutam NEW) e AFTER INSERT (loga a transição inicial com a linha já persistida).

create or replace function public.clients_on_stage_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' and NEW.pipeline_stage is distinct from OLD.pipeline_stage then
    insert into public.client_transitions(client_id, from_stage, to_stage, actor_id)
    values (NEW.id, OLD.pipeline_stage, NEW.pipeline_stage, auth.uid());

    insert into public.client_events(client_id, organization_id, type, payload, actor_id)
    values (NEW.id, NEW.organization_id, 'STAGE_CHANGED',
            jsonb_build_object('from', OLD.pipeline_stage, 'to', NEW.pipeline_stage), auth.uid());

    if NEW.pipeline_stage = 'ATIVO' then
      NEW.operations_locked := false;
      NEW.activated_at := coalesce(NEW.activated_at, now());
    elsif NEW.pipeline_stage in ('CHURNED','PERDIDO') then
      NEW.operations_locked := true;
      NEW.churned_at := coalesce(NEW.churned_at, now());
    else
      NEW.operations_locked := true;
    end if;
  end if;
  return NEW;
end $$;

create or replace function public.clients_on_insert_log()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.client_transitions(client_id, from_stage, to_stage, actor_id, reason)
  values (NEW.id, null, NEW.pipeline_stage, auth.uid(), 'created');
  return null;
end $$;

drop trigger if exists trg_clients_stage_change on public.clients;
create trigger trg_clients_stage_change
  before update of pipeline_stage on public.clients
  for each row execute function public.clients_on_stage_change();

drop trigger if exists trg_clients_insert_log on public.clients;
create trigger trg_clients_insert_log
  after insert on public.clients
  for each row execute function public.clients_on_insert_log();
