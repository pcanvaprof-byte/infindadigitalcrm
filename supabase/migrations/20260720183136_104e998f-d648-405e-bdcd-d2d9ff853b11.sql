revoke execute on function public.cad_import_from_prospects(uuid[]) from public;
revoke execute on function public.cad_import_from_prospects(uuid[]) from anon;
grant execute on function public.cad_import_from_prospects(uuid[]) to authenticated;