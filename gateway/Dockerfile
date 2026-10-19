FROM node:20-alpine

WORKDIR /app

# Instala dependências de compilação mínimas para dependências nativas (se houver)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Pasta persistente para sessão do WhatsApp
VOLUME ["/app/auth_info_baileys"]

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.mjs"]
