-- Importação de Prospecção deve pular silenciosamente leads que já existem
-- na cadência da organização pelo mesmo WhatsApp/telefone normalizado
-- (índices únicos ux_cad_leads_org_whatsapp_norm / ux_cad_leads_org_telefone_norm).
-- Sem esta guarda, o INSERT falha com 23505 quando o mesmo número aparece
-- em outro prospect (ex.: pós-dedupe) e o import inteiro é abortado.

create or replace function public.cad_import_from_prospects(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int; v_org uuid;
begin
  v_org := public.current_org_id();

  insert into public.cad_leads (
    organization_id, owner_id, prospect_id, empresa, responsavel, cargo, telefone, whatsapp,
    primeira_abordagem_at, stage, next_action_at
  )
  select
    v_org,
    auth.uid(),
    p.id,
    coalesce(p.company, 'Sem nome'),
    p.owner_name,
    null::text,
    p.phone,
    p.whatsapp,
    coalesce(
      (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id),
      p.created_at,
      now()
    ),
    'followup_1'::public.cad_stage,
    coalesce(
      (select max(t.enviado_em) from public.prospect_touchpoints t where t.prospect_id = p.id),
      p.created_at,
      now()
    ) + interval '2 days'
  from public.prospects p
  where p.user_id = auth.uid()
    and (p_ids is null or p.id = any(p_ids))
    and not exists (select 1 from public.cad_leads cl where cl.prospect_id = p.id)
    -- pula duplicatas por whatsapp normalizado já presentes na org (não-perdidos)
    and not exists (
      select 1 from public.cad_leads cl
       where cl.organization_id = v_org
         and cl.stage is distinct from 'perdido'::public.cad_stage
         and public.cad_norm_phone(cl.whatsapp) is not null
         and public.cad_norm_phone(cl.whatsapp) = public.cad_norm_phone(p.whatsapp)
    )
    -- pula duplicatas por telefone normalizado já presentes na org (não-perdidos)
    and not exists (
      select 1 from public.cad_leads cl
       where cl.organization_id = v_org
         and cl.stage is distinct from 'perdido'::public.cad_stage
         and public.cad_norm_phone(cl.telefone) is not null
         and public.cad_norm_phone(cl.telefone) = public.cad_norm_phone(p.phone)
    );

  get diagnostics v_count = row_count;
  return v_count;
end $$;

grant execute on function public.cad_import_from_prospects(uuid[]) to authenticated;
