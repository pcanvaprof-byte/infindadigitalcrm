import { createFileRoute } from "@tanstack/react-router";
import { CORS_HEADERS, optionsResponse } from "@/lib/api-public/cors";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "Infinda CRM API",
    version: "1.0.0",
    description:
      "API para agentes de IA (Claude, n8n) consultarem e atualizarem clientes, tarefas, interações e propostas da sua organização. Autenticação: Bearer token com chave gerada no perfil.",
  },
  servers: [{ url: "/api/public/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "infd_live_..." },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/me": {
      get: { summary: "Informações da chave e organização", responses: { "200": { description: "OK" } } },
    },
    "/clients": {
      get: {
        summary: "Listar clientes",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" }, description: "Busca por nome/contato/email" },
          { name: "status", in: "query", schema: { type: "string" }, description: "Filtrar por pipeline_stage" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { "200": { description: "OK" } },
      },
      post: { summary: "Criar cliente", responses: { "201": { description: "Criado" } } },
    },
    "/clients/{id}": {
      get: { summary: "Buscar cliente por ID", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
      patch: { summary: "Atualizar cliente (incluindo pipeline_stage)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
    },
    "/clients/{id}/interactions": {
      get: { summary: "Histórico de interações do cliente", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" } } },
      post: { summary: "Registrar nova interação (nota/ligação/whatsapp/email)", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": { description: "Criado" } } },
    },
    "/tasks": {
      get: {
        summary: "Listar tarefas de cadência",
        parameters: [
          { name: "due", in: "query", schema: { type: "string", enum: ["today", "overdue"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: { "200": { description: "OK" } },
      },
      post: { summary: "Criar nova tarefa/lead de cadência", responses: { "201": { description: "Criado" } } },
    },
    "/proposals": {
      post: { summary: "Criar proposta comercial (rascunho) para um cliente", responses: { "201": { description: "Criado" } } },
    },
  },
} as const;

export const Route = createFileRoute("/api/public/v1/openapi")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async () =>
        new Response(JSON.stringify(spec, null, 2), {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }),
    },
  },
});