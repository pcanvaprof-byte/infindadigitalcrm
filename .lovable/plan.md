## Diagnóstico

A biblioteca está vazia por **dois motivos combinados**, não por falta de templates:

1. **Existem 46 packs oficiais no banco** (`default`, `restaurante`, `dentista`, `medico`, `contabilidade`, `imobiliaria`, `academia`, `loja_infantil`, `loja_roupas`, `concessionaria`, `b2b_saas`, `restaurante_delivery`, `estetica`, `educacao`, `petshop`, `advocacia`, `barbearia`, `salao_beleza`, `marketing_agencia`, `tecnologia`, `wa_padrao`, etc.), todos com 13 mensagens (`template_count=13`). Cobrem a lista de nichos solicitada.
2. Ao chamar `supabase.rpc('cad_list_packs')` no navegador, o PostgREST responde:
   ```
   PGRST202 — Could not find the function public.cad_list_packs in the schema cache
   ```
   O RPC funciona direto no Postgres (retorna 46 linhas) mas o **schema cache do PostgREST está defasado** — por isso a UI mostra "Nenhum pack encontrado".
3. O usuário logado também não tem linha em `user_active_org` nem em `organization_members` (0 registros). Mesmo com o cache corrigido, funcionalidades como "Ativar pack" e `cad_toggle_favorite` falhariam porque `current_org_id()` retornaria `null`.

## Correções

### Migração 1 — Recarregar o schema cache e garantir contrato do RPC
- `NOTIFY pgrst, 'reload schema';`
- Recriar `public.cad_list_packs()` idêntico ao atual para forçar bump do cache (também garante `GRANT EXECUTE ... TO authenticated`).
- Recriar `public.cad_get_pack_templates(text)` com `GRANT EXECUTE`.

### Migração 2 — Backfill de organização para usuários existentes
- Para todo `auth.users` sem linha em `organization_members`: inserir em `organization_members` (org "INFINDA" como default) e em `user_active_org`.
- Confirmar que o trigger `handle_new_user_default_org` já cobre novos cadastros (já existe).

### Validação
- `SELECT count(*) FROM cad_template_packs WHERE is_system;` → deve retornar ~30.
- `SELECT count(*) FROM cad_list_packs();` executado como `authenticated` → 46.
- No preview, `supabase.rpc('cad_list_packs')` deve devolver a lista completa, e a tela "Biblioteca de cadências" abrir populada com os packs oficiais agrupados por categoria.

### Fora de escopo
Nenhuma alteração em componentes React — `TemplateLibrary.tsx` já lê corretamente via `cad_list_packs`; o problema é 100% backend (cache + backfill de org).