// Edge Function: send-gmail
// Envia email via Gmail API usando o token OAuth do operador.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) return null;
  return data;
}

function buildEmailRaw(to: string, from: string, subject: string, body: string): string {
  const email = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].join("\r\n");

  // Base64url encoding
  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verifica o JWT e pega o user_id
    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!)
      .auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body } = await req.json();
    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: to, subject, body" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Busca o token do operador
    const { data: tokenRow, error: tokenError } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(JSON.stringify({ error: "Gmail não conectado. Conecte sua conta em Configurações." }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    let accessToken = tokenRow.access_token;

    // Renova o token se estiver expirado (com 5 min de margem)
    const expiresAt = new Date(tokenRow.expires_at).getTime();
    if (Date.now() > expiresAt - 5 * 60 * 1000) {
      if (!tokenRow.refresh_token) {
        return new Response(JSON.stringify({ error: "Token expirado. Reconecte o Gmail em Configurações." }), {
          status: 401, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const refreshed = await refreshAccessToken(tokenRow.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "Falha ao renovar token. Reconecte o Gmail." }), {
          status: 401, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabase.from("gmail_oauth_tokens").update({
        access_token: accessToken,
        expires_at: newExpiry,
      }).eq("user_id", user.id);
    }

    // Envia o email via Gmail API
    const raw = buildEmailRaw(to, tokenRow.email, subject, body);
    const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    const gmailData = await gmailRes.json();
    if (gmailData.error) {
      return new Response(JSON.stringify({ error: `Gmail API: ${gmailData.error.message}` }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: gmailData.id,
      from: tokenRow.email,
    }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
