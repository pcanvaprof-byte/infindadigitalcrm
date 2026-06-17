import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_BYTES = 100 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|docx?|png|jpe?g|webp|zip|mp4)$/i;

const SignInput = z.object({
  token: z.string().min(8),
  field: z.string().min(1).max(120),
  filename: z.string().min(1).max(200).regex(/^[\w. ()\-+]+$/),
  size: z.number().int().positive().max(MAX_BYTES),
  contentType: z.string().min(1).max(120),
});

function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server env ausente");
  return import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
  );
}

/** Gera signed upload URL para anexar arquivo a um briefing/kickoff via token público. */
export const createKickoffUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SignInput.parse(d))
  .handler(async ({ data }) => {
    if (!ALLOWED_EXT.test(data.filename)) throw new Error("Extensão não permitida");
    const admin = await getAdmin();
    // valida que o briefing existe
    const { data: rows, error: bErr } = await admin
      .from("briefings")
      .select("id, status")
      .eq("token_publico", data.token)
      .limit(1);
    if (bErr) throw bErr;
    const briefing = rows?.[0];
    if (!briefing) throw new Error("Briefing não encontrado");
    if (briefing.status === "concluido" || briefing.status === "cancelado") {
      throw new Error("Briefing finalizado — uploads bloqueados");
    }
    const path = `${data.token}/${data.field}/${Date.now()}-${data.filename}`;
    const { data: signed, error } = await admin.storage
      .from("kickoff-uploads")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

const DownloadInput = z.object({ token: z.string().min(8), path: z.string().min(1) });

/** Gera signed URL de leitura (usada no dashboard interno). */
export const getKickoffFileUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => DownloadInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.path.startsWith(`${data.token}/`)) throw new Error("Path inválido");
    const admin = await getAdmin();
    const { data: signed, error } = await admin.storage
      .from("kickoff-uploads")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw error;
    return { url: signed.signedUrl };
  });