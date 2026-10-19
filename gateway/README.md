# WhatsApp Gateway (Baileys v7 / WA-AKG Compatible)

Gateway REST API leve e autônomo baseado em `@whiskeysockets/baileys` para disparo silencioso de mensagens de WhatsApp diretamente pelo CRM INFINDA sem abrir abas (`wa.me` ou `web.whatsapp.com`).

---

## 🎯 Características
- **Zero Banco de Dados Externo**: Não requer MySQL nem Docker pesado. Usa autenticação em pasta local (`auth_info_baileys/`).
- **Compatível com a API REST WA-AKG v1.7.0**:
  - `GET /api/sessions`: Retorna status da conexão e QR Code em DataURL (`data:image/png;base64,...`).
  - `POST /api/messages/:sessionId/:jid/send`: Envio de mensagens de texto direto pelo socket.
  - `POST /api/messages/:sessionId/:jid/interactive`: Suporte a botões interativos nativos (Quick Reply).
  - `POST /api/sessions/:sessionId/logout`: Desconecta e gera novo QR Code.
- **Painel QR Code Integrado**: O QR Code pode ser escaneado diretamente dentro da tela `/prospeccao` do INFINDA CRM ou acessando `http://localhost:3000/qr`.

---

## 🚀 Como Rodar em Desenvolvimento (Local)
Na raiz do projeto `infindaleads`:
```bash
npm run gateway
```
Ou dentro desta pasta `gateway`:
```bash
npm install
node server.mjs
```

---

## 🌐 Como Rodar em Produção (Nuvem / VPS)

Como o frontend do INFINDA roda em **HTTPS** (Vercel ou domínio próprio), o Gateway precisa ser exposto via **HTTPS** para evitar bloqueio de *Mixed Content* nos navegadores.

### Opção 1: Railway (Recomendado - 2 minutos)
1. Crie uma conta no [Railway.app](https://railway.app).
2. Clique em **New Project** $\rightarrow$ **Deploy from GitHub repo** $\rightarrow$ Selecione `infindadigitalcrm`.
3. Nas configurações do serviço:
   - **Root Directory**: `gateway` (ou deixe a raiz, o arquivo `railway.json` já está configurado).
   - Adicione um **Volume** montado em `/app/auth_info_baileys` para manter a sessão do WhatsApp salva mesmo após reinicializações.
4. O Railway gerará uma URL HTTPS pública, por exemplo: `https://infinda-gateway.up.railway.app`.
5. Na **Vercel** (ou nas variáveis de ambiente do seu CRM em produção), adicione:
   ```env
   VITE_WA_GATEWAY_URL=https://infinda-gateway.up.railway.app
   ```

### Opção 2: Render.com
1. No [Render.com](https://render.com), crie um novo **Blueprint** ou **Web Service**.
2. Conecte o repositório `infindadigitalcrm` (o arquivo `render.yaml` na raiz já configura o disco persistente e a porta automaticamente).
3. Pegue a URL pública gerada (`https://infinda-wa-gateway.onrender.com`) e configure na Vercel:
   ```env
   VITE_WA_GATEWAY_URL=https://infinda-wa-gateway.onrender.com
   ```

### Opção 3: VPS Linux Própria (Ubuntu / Debian com Docker ou PM2)
Com Docker:
```bash
cd gateway
docker build -t infinda-wa-gateway .
docker run -d --name wa-gateway -p 3000:3000 -v wa_auth:/app/auth_info_baileys --restart unless-stopped infinda-wa-gateway
```
Com Nginx / Certbot para HTTPS ou Cloudflare Tunnel gratuito:
```bash
cloudflared tunnel --url http://localhost:3000
```
