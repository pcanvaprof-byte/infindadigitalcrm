import { supabase } from "@/integrations/supabase/client";

export interface GmailTokenStatus {
  connected: boolean;
  email?: string;
}

/** Verifica se o operador atual tem Gmail conectado */
export async function getGmailStatus(): Promise<GmailTokenStatus> {
  const { data, error } = await supabase
    .from("gmail_oauth_tokens" as never)
    .select("email")
    .maybeSingle();
  if (error || !data) return { connected: false };
  return { connected: true, email: (data as { email: string }).email };
}

/** Gera a URL de autorização do Google e abre numa nova aba */
export async function connectGmail(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão expirada");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-url`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  window.open(json.url, "_blank", "width=500,height=600");
}

/** Desconecta o Gmail removendo o token do banco */
export async function disconnectGmail(): Promise<void> {
  await supabase.from("gmail_oauth_tokens" as never).delete();
}

export interface SendGmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface SendGmailResult {
  success: boolean;
  messageId?: string;
  from?: string;
  error?: string;
}

/** Envia email via Edge Function send-gmail */
export async function sendGmail(input: SendGmailInput): Promise<SendGmailResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sessão expirada");

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-gmail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );
  return res.json();
}
