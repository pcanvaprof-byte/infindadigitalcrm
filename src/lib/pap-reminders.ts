import { toast } from "sonner";

export type PapReminder = {
  id: string;
  prospectId: string;
  company: string;
  notes: string;
  dueAt: string; // ISO
  remindBeforeMin?: number; // optional pre-alert (default 0)
  notified?: boolean;
  preNotified?: boolean;
};

const KEY = "pap.reminders.v1";
const timers = new Map<string, number[]>();

function read(): PapReminder[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function write(list: PapReminder[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("pap-reminders:changed"));
}

export function listReminders(): PapReminder[] {
  return read().sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export function removeReminder(id: string) {
  write(read().filter((r) => r.id !== id));
  clearTimers(id);
}

function clearTimers(id: string) {
  const arr = timers.get(id);
  if (arr) arr.forEach((t) => clearTimeout(t));
  timers.delete(id);
}

async function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const p = await Notification.requestPermission();
    return p === "granted";
  } catch {
    return false;
  }
}

function fire(r: PapReminder, kind: "pre" | "due") {
  const title = kind === "pre" ? `⏰ Lembrete em breve: ${r.company}` : `🔔 Follow-up agora: ${r.company}`;
  const body = r.notes || "Follow-up PAP";
  toast(title, { description: body, duration: 12000 });
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, tag: r.id });
    }
  } catch {}
  const list = read();
  const i = list.findIndex((x) => x.id === r.id);
  if (i >= 0) {
    if (kind === "pre") list[i].preNotified = true;
    else list[i].notified = true;
    write(list);
  }
}

function schedule(r: PapReminder) {
  clearTimers(r.id);
  const now = Date.now();
  const due = new Date(r.dueAt).getTime();
  const ts: number[] = [];
  const preMin = r.remindBeforeMin ?? 0;
  if (preMin > 0 && !r.preNotified) {
    const pre = due - preMin * 60_000;
    if (pre > now) ts.push(window.setTimeout(() => fire(r, "pre"), pre - now));
  }
  if (!r.notified) {
    if (due <= now) fire(r, "due");
    else ts.push(window.setTimeout(() => fire(r, "due"), due - now));
  }
  timers.set(r.id, ts);
}

export async function addReminder(input: Omit<PapReminder, "id" | "notified" | "preNotified">) {
  await ensureNotificationPermission();
  const r: PapReminder = { ...input, id: crypto.randomUUID() };
  const list = read();
  list.push(r);
  write(list);
  schedule(r);
  return r;
}

/** Re-arma timers ao carregar o app. */
export function bootReminders() {
  if (typeof window === "undefined") return;
  const list = read();
  list.forEach(schedule);
}