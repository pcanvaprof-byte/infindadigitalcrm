-- Leads compartilhados: cada usuário pode iniciar sua própria cadência
-- sobre qualquer prospect da organização. Idempotente por (prospect_id, owner_id):
-- nunca reutiliza nem altera a cadência de outro usuário.

CREATE UNIQUE INDEX IF NOT EXISTS cad_leads_prospect_owner_uniq
  ON public.cad_leads (prospect_id, owner_id)
  WHERE prospect_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cad_import_from_prospects(p_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_org uuid := public.current_org_id();
  v_count int;
begin
  if v_uid is null then raise exception 'auth_required'; end if;
  if v_org is null then raise exception 'no_active_org'; end if;

  insert into public.cad_leads (
    organization_id, owner_id, prospect_id, empresa, responsavel, cargo, telefone, whatsapp,
    primeira_abordagem_at, stage, next_action_at
  )
  select v_org, v_uid, p.id,
    coalesce(p.company, 'Sem nome'), p.owner_name, null::text, p.phone, p.whatsapp,
    coalesce(p.created_at, now()), 'followup_1', now() + interval '3 days'
  from public.prospects p
  where p.organization_id = v_org
    and (p_ids is null or p.id = any(p_ids))
    and not exists (
      select 1 from public.cad_leads cl
       where cl.prospect_id = p.id and cl.owner_id = v_uid
    );

  get diagnostics v_count = row_count;
  return v_count;
end $function$;