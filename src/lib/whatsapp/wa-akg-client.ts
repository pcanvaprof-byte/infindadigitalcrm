export interface WaAkgConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  sessionId: string;
  useInteractive: boolean;
  interactiveButtons: string[];
}

const ENV_GATEWAY_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_WA_GATEWAY_URL) ||
  "https://infindadigitalcrm.onrender.com";

const ENV_GATEWAY_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_WA_GATEWAY_KEY) ||
  "";

export const DEFAULT_WA_AKG_CONFIG: WaAkgConfig = {
  enabled: false,
  apiUrl: ENV_GATEWAY_URL,
  apiKey: ENV_GATEWAY_KEY,
  sessionId: "default",
  useInteractive: false,
  interactiveButtons: ["Tenho interesse", "Mais detalhes", "Agora não"],
};

const STORAGE_KEY = "infinda_wa_akg_config";

export function loadWaAkgConfig(): WaAkgConfig {
  if (typeof window === "undefined") return DEFAULT_WA_AKG_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WA_AKG_CONFIG;
    const parsed = JSON.parse(raw);
    const apiUrl =
      (parsed.apiUrl === "http://localhost:3000" && ENV_GATEWAY_URL !== "http://localhost:3000")
        ? ENV_GATEWAY_URL
        : (parsed.apiUrl || DEFAULT_WA_AKG_CONFIG.apiUrl);
    return {
      ...DEFAULT_WA_AKG_CONFIG,
      ...parsed,
      apiUrl,
      interactiveButtons: Array.isArray(parsed.interactiveButtons) && parsed.interactiveButtons.length > 0
        ? parsed.interactiveButtons
        : DEFAULT_WA_AKG_CONFIG.interactiveButtons,
    };
  } catch {
    return DEFAULT_WA_AKG_CONFIG;
  }
}

export function saveWaAkgConfig(cfg: WaAkgConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error("[WA-AKG] Failed to save config to localStorage", e);
  }
}

export function formatWaJid(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return "";
  // Ensure Brazil country code 55 if length is 10 or 11
  let clean = digits;
  if (!clean.startsWith("55") && (clean.length === 10 || clean.length === 11)) {
    clean = `55${clean}`;
  }
  return `${clean}@s.whatsapp.net`;
}

export interface WaAkgSession {
  id: string;
  name?: string;
  status?: string;
  phone?: string;
  ready?: boolean;
  qr?: string;
}

export async function testWaAkgConnection(config: Pick<WaAkgConfig, "apiUrl" | "apiKey">): Promise<{
  ok: boolean;
  sessions?: WaAkgSession[];
  error?: string;
}> {
  const url = config.apiUrl.replace(/\/+$/, "");
  const endpoint = `${url}/api/sessions`;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "bypass-tunnel-reminder": "true",
    };
    if (config.apiKey.trim()) {
      headers["X-API-Key"] = config.apiKey.trim();
    }

    const res = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `HTTP ${res.status}: ${body.slice(0, 150) || res.statusText}`,
      };
    }

    const data = await res.json();
    const sessions = Array.isArray(data)
      ? data
      : Array.isArray(data.sessions)
      ? data.sessions
      : Array.isArray(data.data)
      ? data.data
      : [];

    return {
      ok: true,
      sessions,
    };
  } catch (err: unknown) {
    const isAbort = (err as { name?: string })?.name === "AbortError";
    return {
      ok: false,
      error: isAbort ? "Timeout: Gateway não respondeu em 8s" : (err instanceof Error ? err.message : String(err)),
    };
  }
}

export async function disconnectWaAkgSession(config?: Pick<WaAkgConfig, "apiUrl" | "apiKey" | "sessionId">): Promise<{
  ok: boolean;
  error?: string;
}> {
  const cfg = config ?? loadWaAkgConfig();
  const url = (cfg.apiUrl || "http://localhost:3000").replace(/\/+$/, "");
  const sess = cfg.sessionId || "default";
  try {
    const res = await fetch(`${url}/api/sessions/${encodeURIComponent(sess)}/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "bypass-tunnel-reminder": "true",
        ...(cfg.apiKey ? { "X-API-Key": cfg.apiKey } : {}),
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface SendWaMessageParams {
  phone: string;
  message: string;
  config?: WaAkgConfig;
}

export interface SendWaMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envia mensagem via Gateway WA-AKG v1.7.0
 * Suporta mensagem de texto normal e mensagens interativas com botões nativos.
 */
export async function sendWaAkgMessage({
  phone,
  message,
  config: customConfig,
}: SendWaMessageParams): Promise<SendWaMessageResult> {
  const cfg = customConfig ?? loadWaAkgConfig();
  const jid = formatWaJid(phone);

  if (!jid) {
    return { success: false, error: "Número de telefone/WhatsApp inválido." };
  }

  const baseUrl = (cfg.apiUrl || "http://localhost:3000").replace(/\/+$/, "");
  const sessionId = cfg.sessionId.trim() || "default";
  const apiKey = cfg.apiKey.trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "bypass-tunnel-reminder": "true",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);

  try {
    // 1) Se mensagens interativas estiverem ativadas (recurso v1.7.0 do WA-AKG)
    if (cfg.useInteractive && cfg.interactiveButtons.length > 0) {
      const interactiveEndpoint = `${baseUrl}/api/messages/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}/interactive`;
      
      const buttons = cfg.interactiveButtons.slice(0, 3).map((btnText, idx) => ({
        id: `opt_${idx + 1}`,
        text: btnText.trim(),
      }));

      const res = await fetch(interactiveEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "quick_reply",
          body: message,
          buttons,
        }),
        signal: ctrl.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return { success: true, messageId: json?.messageId || json?.id };
      }

      // Se falhar a rota interativa (ex: sessão não suporta ou versão antiga), faz fallback para envio normal
      console.warn("[WA-AKG] Rota interativa falhou, tentando envio de texto padrão...", res.status);
    }

    // 2) Envio padrão de texto (WA-AKG /api/messages/:session/:jid/send)
    const sendEndpoint = `${baseUrl}/api/messages/${encodeURIComponent(sessionId)}/${encodeURIComponent(jid)}/send`;
    const res = await fetch(sendEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: {
          text: message,
        },
      }),
      signal: ctrl.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        error: `Erro HTTP ${res.status}: ${errText.slice(0, 180) || res.statusText}`,
      };
    }

    const data = await res.json().catch(() => ({}));
    return {
      success: true,
      messageId: data?.messageId || data?.id || data?.key?.id,
    };
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort = (err as { name?: string })?.name === "AbortError";
    return {
      success: false,
      error: isAbort ? "Tempo limite esgotado ao disparar via Gateway (15s)" : (err instanceof Error ? err.message : String(err)),
    };
  }
}
