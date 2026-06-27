import type { CadLead } from "./types";

export type DispatchFilter = "all" | "due" | "overdue" | "future";

/** Bucketiza um lead conforme a relação entre next_action_at e agora. */
export function dispatchBucket(
  lead: Pick<CadLead, "next_action_at">,
  now: number = Date.now(),
): "overdue" | "due" | "future" | "none" {
  if (!lead.next_action_at) return "none";
  const t = new Date(lead.next_action_at).getTime();
  if (Number.isNaN(t)) return "none";
  // "due" = vence dentro das próximas 24h e ainda não venceu
  if (t < now) return "overdue";
  if (t - now <= 24 * 60 * 60 * 1000) return "due";
  return "future";
}

/**
 * Ordena leads por data de disparo:
 *  1) vencidos e no prazo primeiro (mais antigos no topo)
 *  2) agendados para o futuro no final (cronológico ascendente)
 *  3) sem data por último
 *
 * Esta é a MESMA regra usada no back-end (ORDER BY next_action_at asc NULLS LAST).
 */
export function sortLeadsByDispatchDate<T extends Pick<CadLead, "next_action_at">>(
  leads: T[],
  now: number = Date.now(),
): T[] {
  return [...leads].sort((a, b) => {
    const ta = a.next_action_at ? new Date(a.next_action_at).getTime() : null;
    const tb = b.next_action_at ? new Date(b.next_action_at).getTime() : null;
    const aFuture = ta !== null && ta > now;
    const bFuture = tb !== null && tb > now;
    if (aFuture !== bFuture) return aFuture ? 1 : -1;
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}

export function filterLeadsByDispatch<T extends Pick<CadLead, "next_action_at">>(
  leads: T[],
  mode: DispatchFilter,
  now: number = Date.now(),
): T[] {
  if (mode === "all") return leads;
  return leads.filter((l) => {
    const b = dispatchBucket(l, now);
    if (mode === "overdue") return b === "overdue";
    if (mode === "due") return b === "due" || b === "overdue";
    if (mode === "future") return b === "future";
    return true;
  });
}
