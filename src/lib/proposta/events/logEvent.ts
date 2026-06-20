import { supabase } from "@/integrations/supabase/client";
import {
  PROPOSAL_EVENT_TYPES,
  type LogEventInput,
  type ProposalEventType,
} from "./types";

/**
 * Helper único para emitir eventos de negócio (`evt_*`).
 *
 * Regra EBD (docs/architecture/event-boundaries.md):
 *  - Todo INSERT em `proposal_events` passa por esta função (que chama o RPC
 *    `log_evt` SECURITY DEFINER). INSERTs diretos via `supabase.from(...)` são
 *    bloqueados pelo linter `scripts/lint-ebd.mjs`.
 *  - Eventos de auditoria estrutural (`aud_*`) vivem em outra tabela
 *    (`audit_logs`) e NUNCA devem ser emitidos por aqui.
 */
export async function logEvent(input: LogEventInput): Promise<string | null> {
  const type = ensurePrefix(input.type);
  if (!isKnownEventType(type)) {
    // Falha silenciosa em prod, ruidosa em dev. Evita derrubar fluxo comercial.
    if (import.meta.env.DEV) {
      console.warn(`[EBD] event_type desconhecido: ${type}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb.rpc("log_evt", {
    p_proposal_id: input.proposalId,
    p_tipo: type,
    p_payload: input.payload ?? {},
    p_actor_type: input.actor ?? "user",
  });

  if (error) {
    if (import.meta.env.DEV) console.warn("[EBD] log_evt falhou:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

function ensurePrefix(t: string): ProposalEventType {
  return (t.startsWith("evt_") ? t : `evt_${t}`) as ProposalEventType;
}

function isKnownEventType(t: string): t is ProposalEventType {
  return (PROPOSAL_EVENT_TYPES as readonly string[]).includes(t);
}