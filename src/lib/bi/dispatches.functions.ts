import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auditoria consistente de disparos no backend (sem depender do navegador).
 *
 * Conta mensagens por fonte:
 *  - cad_messages     → disparos da Cadência
 *  - prospect_touchpoints (tipo=whatsapp|ligacao|email|reuniao, outbound) → Prospecção
 *
 * RLS é aplicado como o usuário autenticado, portanto o resultado é escopo da
 * organização atual do solicitante.
 */

type Range = { from: string; to: string; label: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function localTs(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(off) / 60));
  const om = pad(Math.abs(off) % 60);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${oh}:${om}`
  );
}
function dayRange(d = new Date()): Range {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(23, 59, 59, 999);
  return { from: localTs(a), to: localTs(b), label: "hoje" };
}
function weekRange(d = new Date()): Range {
  const a = new Date(d);
  const dow = a.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  a.setDate(a.getDate() + diff);
  a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(23, 59, 59, 999);
  return { from: localTs(a), to: localTs(b), label: "semana" };
}

const OUTBOUND_TYPES = ["whatsapp", "ligacao", "email", "reuniao"] as const;

export interface DispatchBucket {
  range: Range;
  total: number;
  cadencia: number;
  prospeccao: number;
  por_tipo: Record<string, number>; // whatsapp, ligacao, email, reuniao
  por_canal: { cad_messages: number; prospect_touchpoints: number };
}

export interface DispatchAuditResult {
  generated_at: string;
  user_id: string;
  today: DispatchBucket;
  yesterday: DispatchBucket;
  week: DispatchBucket;
  custom?: DispatchBucket;
}

async function countBucket(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  range: Range,
): Promise<DispatchBucket> {
  const [cadRes, tpRes] = await Promise.all([
    supabase
      .from("cad_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    supabase
      .from("prospect_touchpoints")
      .select("tipo")
      .gte("enviado_em", range.from)
      .lte("enviado_em", range.to)
      .in("tipo", OUTBOUND_TYPES as unknown as string[]),
  ]);

  const cadCount = cadRes.count ?? 0;
  const tpRows = ((tpRes.data ?? []) as Array<{ tipo: string }>);
  const por_tipo: Record<string, number> = { whatsapp: 0, ligacao: 0, email: 0, reuniao: 0 };
  for (const r of tpRows) {
    por_tipo[r.tipo] = (por_tipo[r.tipo] ?? 0) + 1;
  }
  // cad_messages atualmente são todas via whatsapp na cadência → soma no por_tipo
  por_tipo.whatsapp += cadCount;

  const tpTotal = tpRows.length;
  return {
    range,
    total: cadCount + tpTotal,
    cadencia: cadCount,
    prospeccao: tpTotal,
    por_tipo,
    por_canal: { cad_messages: cadCount, prospect_touchpoints: tpTotal },
  };
}

export const auditDispatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from?: string; to?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const today = dayRange();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yesterday = dayRange(y);
    const week = weekRange();

    const [t, ye, w] = await Promise.all([
      countBucket(context.supabase, today),
      countBucket(context.supabase, yesterday),
      countBucket(context.supabase, week),
    ]);

    let custom: DispatchBucket | undefined;
    if (data?.from && data?.to) {
      const a = new Date(data.from); a.setHours(0, 0, 0, 0);
      const b = new Date(data.to); b.setHours(23, 59, 59, 999);
      const range: Range = { from: localTs(a), to: localTs(b), label: "custom" };
      custom = await countBucket(context.supabase, range);
    }

    const result: DispatchAuditResult = {
      generated_at: new Date().toISOString(),
      user_id: context.userId,
      today: t,
      yesterday: ye,
      week: w,
      custom,
    };
    return result;
  });