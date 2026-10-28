FROM node:20-alpine

WORKDIR /app

# Instala dependências de compilação mínimas para dependências nativas
RUN apk add --no-cache python3 make g++

# Suporta tanto build context na raiz do repositório quanto dentro da pasta gateway
COPY . ./src_raw/

RUN if [ -d "./src_raw/gateway" ]; then \
      cp -r ./src_raw/gateway/* ./; \
    else \
      cp -r ./src_raw/* ./; \
    fi && rm -rf ./src_raw

RUN npm install --omit=dev

# Pasta persistente para sessão do WhatsApp (MultiFileAuthState)
VOLUME ["/app/auth_info_baileys"]

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.mjs"]
