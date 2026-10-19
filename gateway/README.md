# WhatsApp Gateway Local (Baileys v7 / WA-AKG Compatible)

Gateway REST API leve e autônomo baseado em `@whiskeysockets/baileys` para disparo silencioso de mensagens de WhatsApp diretamente pelo CRM INFINDA sem abrir abas (`wa.me` ou `web.whatsapp.com`).

## Características
- **Zero Banco de Dados Externo**: Não requer MySQL nem Docker. Usa autenticação em pasta local (`auth_info_baileys/`).
- **Compatível com a API REST WA-AKG**:
  - `GET /api/sessions`: Retorna status da conexão e QR Code em DataURL (`data:image/png;base64,...`).
  - `POST /api/messages/:sessionId/:jid/send`: Envio de mensagens de texto direto pelo socket.
  - `POST /api/messages/:sessionId/:jid/interactive`: Suporte a botões interativos (Quick Reply).
  - `POST /api/sessions/:sessionId/logout`: Desconecta e gera novo QR Code.
- **Painel QR Code Integrado**: O QR Code pode ser escaneado diretamente dentro da tela `/prospeccao` do INFINDA CRM ou acessando `http://localhost:3000/qr`.

## Como Iniciar
Na raiz do projeto `infindaleads`:
```bash
npm run gateway
```
Ou dentro desta pasta `gateway`:
```bash
npm install
node server.mjs
```
