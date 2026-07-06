import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type AdjustmentNote = {
  id: string;
  client_id: string;
  nota: string;
  autor_nome: string | null;
  user_id: string;
  created_at: string;
};

export async function listAdjustmentNotes(clientId: string): Promise<AdjustmentNote[]> {
  const { data, error } = await sb
    .from("adjustment_notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdjustmentNote[];
}

export async function addAdjustmentNote(clientId: string, nota: string, autorNome?: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado");
  const { error } = await sb.from("adjustment_notes").insert({
    client_id: clientId,
    user_id: u.user.id,
    nota,
    autor_nome: autorNome ?? u.user.user_metadata?.full_name ?? u.user.email ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteAdjustmentNote(id: string): Promise<void> {
  const { error } = await sb.from("adjustment_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}