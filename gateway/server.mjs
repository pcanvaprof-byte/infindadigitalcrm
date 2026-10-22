import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import pino from "pino";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, "auth_info_baileys");

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let currentQr = null;
let qrDataUrl = null;
let connectionStatus = "disconnected"; // "disconnected" | "connecting" | "qr_ready" | "connected"
let connectedUser = null;

// Baileys dynamic import
let baileysModule = null;

async function initBaileys() {
  try {
    baileysModule = await import("@whiskeysockets/baileys");
  } catch (err) {
    console.error("Failed to load @whiskeysockets/baileys:", err);
    return;
  }

  const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
  } = baileysModule;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version = [2, 3000, 1015901307];
  try {
    const v = await fetchLatestBaileysVersion();
    if (v?.version) version = v.version;
  } catch {
    // fallback
  }

  console.log(`[WA-Gateway] Iniciando socket WhatsApp Baileys v${version.join(".")}...`);
  connectionStatus = "connecting";

  sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
    auth: state,
    browser: ["Infinda Leads", "Chrome", "1.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQr = qr;
      connectionStatus = "qr_ready";
      try {
        qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
      } catch (e) {
        console.error("Error generating QR data URL:", e);
      }
      console.log("\n=======================================================");
      console.log("📲 ESCANEIE O QR CODE ACIMA COM O SEU WHATSAPP NO CELULAR");
      console.log("Ou abra: http://localhost:3000/qr no navegador");
      console.log("=======================================================\n");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionStatus = "disconnected";
      currentQr = null;
      qrDataUrl = null;
      connectedUser = null;
      console.log(
        `[WA-Gateway] Conexao encerrada (status ${statusCode}). Reconectando? ${shouldReconnect}`
      );
      if (shouldReconnect) {
        setTimeout(initBaileys, 3000);
      } else {
        console.log("[WA-Gateway] Sessao deslogada pelo usuario. Limpando credenciais...");
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        setTimeout(initBaileys, 3000);
      }
    } else if (connection === "open") {
      connectionStatus = "connected";
      currentQr = null;
      qrDataUrl = null;
      connectedUser = sock?.user?.id ? sock.user.id.split(":")[0] : "Conectado";
      console.log("\n=======================================================");
      console.log(`✅ WHATSAPP CONECTADO COM SUCESSO!`);
      console.log(`Número: +${connectedUser}`);
      console.log("O Infinda Leads agora disparará mensagens 100% sem abrir abas!");
      console.log("=======================================================\n");
    }
  });
}

// Servidor HTTP REST compatível com a API do WA-AKG
const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization, Bypass-Tunnel-Reminder",
  });
  res.end(JSON.stringify(data));
}


async function resolveWhatsAppJid(socketInstance, rawInput) {
  let cleanDigits = rawInput.replace(/\D/g, "");
  if (!cleanDigits) return null;
  if (!cleanDigits.startsWith("55") && (cleanDigits.length === 10 || cleanDigits.length === 11)) {
    cleanDigits = "55" + cleanDigits;
  }

  const primaryJid = cleanDigits + "@s.whatsapp.net";

  try {
    const res = await socketInstance.onWhatsApp(primaryJid);
    if (res && res.length > 0 && res[0].exists) {
      return res[0].jid;
    }

    // Se tiver 13 digitos (55 + DDD + 9 + 8 digitos) -> tenta sem o 9
    if (cleanDigits.startsWith("55") && cleanDigits.length === 13) {
      const ddd = cleanDigits.slice(2, 4);
      const rest = cleanDigits.slice(5);
      const altJid = "55" + ddd + rest + "@s.whatsapp.net";
      const altRes = await socketInstance.onWhatsApp(altJid);
      if (altRes && altRes.length > 0 && altRes[0].exists) {
        return altRes[0].jid;
      }
    }

    // Se tiver 12 digitos (55 + DDD + 8 digitos) -> tenta com o 9
    if (cleanDigits.startsWith("55") && cleanDigits.length === 12) {
      const ddd = cleanDigits.slice(2, 4);
      const rest = cleanDigits.slice(4);
      const altJid = "55" + ddd + "9" + rest + "@s.whatsapp.net";
      const altRes = await socketInstance.onWhatsApp(altJid);
      if (altRes && altRes.length > 0 && altRes[0].exists) {
        return altRes[0].jid;
      }
    }
  } catch (err) {
    console.warn("[WA-Gateway] onWhatsApp check error:", err);
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization, Bypass-Tunnel-Reminder",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
  const pathname = url.pathname;

  // 1) Tela amigável com QR Code
  if (pathname === "/qr" || pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    const isReady = connectionStatus === "connected";
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>INFINDA WhatsApp Gateway</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="${isReady ? "15" : "3"}">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h1 { font-size: 20px; margin-bottom: 8px; color: #38bdf8; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .qr-box { background: #fff; padding: 16px; border-radius: 12px; display: inline-block; margin: 20px 0; }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .badge.connected { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .badge.waiting { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
    .phone { font-family: monospace; font-size: 16px; color: #f1f5f9; font-weight: bold; }
    .btn { background: #0ea5e9; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 13px; display: inline-block; margin-top: 16px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="card">
    <h1>⚡ INFINDA WhatsApp Gateway</h1>
    <p>Disparos diretos via API silenciosa, sem abrir abas.</p>

    ${
      isReady
        ? `
        <div class="badge connected">🟢 WhatsApp Conectado e Ativo</div>
        <p class="phone">+${connectedUser}</p>
        <p style="margin-top: 16px;">Sua conta está conectada e pronta para disparos no CRM!</p>
        <a class="btn" href="http://localhost:8080/prospeccao">Voltar para a Prospecção</a>
        `
        : qrDataUrl
        ? `
        <div class="badge waiting">🟡 Aguardando Leitura do QR Code</div>
        <p>Abra o WhatsApp no seu celular → Aparelhos Conectados → Conectar um Aparelho:</p>
        <div class="qr-box">
          <img src="${qrDataUrl}" alt="QR Code" width="280" height="280" style="display:block;" />
        </div>
        <p style="font-size: 11px;">O QR Code é atualizado automaticamente.</p>
        `
        : `
        <div class="badge waiting">⏳ Inicializando conexão...</div>
        <p>Aguarde um instante enquanto geramos o QR Code...</p>
        `
    }
  </div>
</body>
</html>`;
    res.end(html);
    return;
  }

  // 2) GET /api/sessions (Compatibilidade WA-AKG)
  if (pathname === "/api/sessions" && req.method === "GET") {
    sendJson(res, 200, [
      {
        id: "default",
        name: "Sessão Local",
        status: connectionStatus === "connected" ? "connected" : "qr_ready",
        ready: connectionStatus === "connected",
        phone: connectedUser || undefined,
        qr: qrDataUrl || undefined,
      },
    ]);
    return;
  }

  // 3) POST /api/messages/:session/:jid/send (Disparo de texto padrão)
  const matchSend = pathname.match(/^\/api\/messages\/([^/]+)\/([^/]+)\/send$/);
  const matchInteractive = pathname.match(/^\/api\/messages\/([^/]+)\/([^/]+)\/interactive$/);

  if ((matchSend || matchInteractive) && req.method === "POST") {
    if (connectionStatus !== "connected" || !sock) {
      sendJson(res, 400, {
        success: false,
        error: "WhatsApp não está conectado. Escaneie o QR Code em http://localhost:3000/qr",
      });
      return;
    }

    const rawJid = decodeURIComponent((matchSend || matchInteractive)[2]);
    let cleanJid = rawJid;
    if (!cleanJid.includes("@")) {
      const digits = cleanJid.replace(/\D/g, "");
      cleanJid = `${digits}@s.whatsapp.net`;
    }

    let bodyRaw = "";
    req.on("data", (chunk) => (bodyRaw += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(bodyRaw || "{}");
        let textToSend = "";

        if (matchInteractive) {
          // Payload interativo
          textToSend = payload.body || payload.message || "";
          if (Array.isArray(payload.buttons) && payload.buttons.length > 0) {
            const btns = payload.buttons.map((b, i) => `[${i + 1}] ${b.text || b}`).join("\n");
            textToSend = `${textToSend}\n\n${btns}`;
          }
        } else {
          // Payload normal
          textToSend = payload.message?.text || payload.text || payload.message || "";
        }

        if (!textToSend.trim()) {
          sendJson(res, 400, { success: false, error: "Mensagem vazia." });
          return;
        }

        const targetJid = await resolveWhatsAppJid(sock, cleanJid);
        if (!targetJid) {
          console.log(`[WA-Gateway] Número ${cleanJid} NÃO possui conta ativa no WhatsApp.`);
          sendJson(res, 400, {
            success: false,
            error: "Este número não possui WhatsApp ativo (telefone fixo ou desativado).",
            noWhatsApp: true,
          });
          return;
        }

        console.log(`[WA-Gateway] Enviando mensagem para ${targetJid} (original: ${cleanJid})...`);
        const sent = await sock.sendMessage(targetJid, { text: textToSend });
        const messageId = sent?.key?.id || `msg_${Date.now()}`;

        console.log(`[WA-Gateway] Mensagem entregue com sucesso! ID: ${messageId}`);
        sendJson(res, 200, { success: true, messageId });
      } catch (err) {
        console.error("[WA-Gateway] Erro ao enviar mensagem:", err);
        sendJson(res, 500, { success: false, error: err.message || String(err) });
      }
    });
    return;
  }

  // 4) POST /api/sessions/:session/logout ou DELETE (Desconectar)
  const matchLogout = pathname.match(/^\/api\/sessions\/([^/]+)\/(logout|delete)$/);
  if (matchLogout && (req.method === "POST" || req.method === "DELETE")) {
    try {
      if (sock) {
        await sock.logout().catch(() => {});
      }
    } catch {}
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    } catch {}
    connectionStatus = "disconnected";
    currentQr = null;
    qrDataUrl = null;
    connectedUser = null;
    console.log("[WA-Gateway] Sessão desconectada. Gerando novo QR Code...");
    setTimeout(initBaileys, 1000);
    sendJson(res, 200, { success: true, message: "Sessão desconectada com sucesso." });
    return;
  }

  // Rota não encontrada
  sendJson(res, 404, { error: "Rota não encontrada" });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 WA-GATEWAY RODANDO NA PORTA ${PORT}`);
  console.log(`Painel QR Code: http://localhost:${PORT}/qr`);
  console.log(`API Endpoint:  http://localhost:${PORT}/api/messages/default/:jid/send`);
  console.log(`======================================================\n`);
  initBaileys();
});
