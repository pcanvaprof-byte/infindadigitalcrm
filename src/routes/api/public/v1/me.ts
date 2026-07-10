import { createFileRoute } from "@tanstack/react-router";
import { withApiAuth } from "@/lib/api-public/auth.server";
import { json, optionsResponse } from "@/lib/api-public/cors";

export const Route = createFileRoute("/api/public/v1/me")({
  server: {
    handlers: {
      OPTIONS: async () => optionsResponse(),
      GET: async ({ request }) =>
        withApiAuth(request, async (ctx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: org } = await (ctx.admin as any)
            .from("organizations")
            .select("id, name, slug")
            .eq("id", ctx.orgId)
            .maybeSingle();

          return json({
            organization: org ?? { id: ctx.orgId },
            key_id: ctx.keyId,
            capabilities: [
              "clients:read",
              "clients:write",
              "interactions:read",
              "interactions:write",
              "tasks:read",
              "tasks:write",
              "proposals:write",
            ],
            api_version: "v1",
          });
        }),
    },
  },
});