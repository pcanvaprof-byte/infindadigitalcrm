// Edge Function: gmail-oauth-callback
// Recebe o código do Google, troca por tokens e salva no banco.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // HTML de resposta ao operador
  const html = (msg: string, success = true) => new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Infinda CRM</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b0d1a;color:#fff}
    .box{text-align:center;padding:2rem;border-radius:1rem;background:#1a1d2e;max-width:400px}
    h2{color:${success ? "#34d399" : "#f87171"}}p{color:#9ca3af;margin-top:.5rem}</style></head>
    <body><div class="box"><h2>${success ? "✅" : "❌"} ${msg}</h2>
    <p>${success ? "Pode fechar esta aba e voltar ao CRM." : "Tente novamente no CRM."}</p>
    <script>setTimeout(()=>window.close(),3000)</script>
    </div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );

  if (error) return html(`Acesso negado: ${error}`, false);
  if (!code) return html("Código de autorização não encontrado.", false);

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Troca o código por tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) return html(`Erro ao obter tokens: ${tokens.error_description}`, false);

    // 2. Pega o email do operador via API do Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userRes.json();
    if (!userInfo.email) return html("Não foi possível obter o email da conta Google.", false);

    // 3. Descobre o user_id via state (JWT truncado) — busca por email como fallback
    // Usa service_role para gravar o token
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca o user_id pelo email do Supabase Auth que bate com o email Google
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const matchedUser = authUser?.users?.find(
      (u: { email?: string; id: string }) => u.email === userInfo.email
    );

    if (!matchedUser) {
      return html(`Conta Google (${userInfo.email}) não corresponde a nenhum usuário do CRM.`, false);
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // 4. Salva/atualiza o token no banco
    const { error: dbError } = await supabase
      .from("gmail_oauth_tokens")
      .upsert({
        user_id: matchedUser.id,
        email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (dbError) return html(`Erro ao salvar token: ${dbError.message}`, false);

    return html(`Gmail conectado com sucesso! (${userInfo.email})`);
  } catch (e) {
    return html(`Erro inesperado: ${String(e)}`, false);
  }
});
