import "server-only";
import { and, desc, eq, gt, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { emailLog } from "@/db/schema";

const FINAL = ["clicked", "bounced", "complained"];

/** Asks Resend what happened to recent emails (delivered, opened, clicked, bounced) and keeps the latest state.
 *  Runs daily from the cron; checks each email at most every six hours for seven days. Needs open and click
 *  tracking switched on for the domain in Resend. */
export async function refreshEmailStatus(limit = 200) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { checked: 0 };
  const db = await getDb();
  const now = Date.now();
  const rows = await db.select({ id: emailLog.id, resendId: emailLog.resendId }).from(emailLog)
    .where(and(gt(emailLog.sentAt, new Date(now - 7 * 864e5)), sql`${emailLog.resendId} is not null`,
      or(isNull(emailLog.lastEvent), notInArray(emailLog.lastEvent, FINAL)),
      or(isNull(emailLog.checkedAt), lt(emailLog.checkedAt, new Date(now - 6 * 3600e3)))))
    .orderBy(desc(emailLog.sentAt)).limit(limit);
  let checked = 0;
  for (const r of rows) {
    try {
      const res = await fetch(`https://api.resend.com/emails/${r.resendId}`, { headers: { authorization: `Bearer ${key}` } });
      if (!res.ok) { await db.update(emailLog).set({ checkedAt: new Date() }).where(eq(emailLog.id, r.id)); continue; }
      const j = await res.json() as { last_event?: string };
      const ev = typeof j.last_event === "string" ? j.last_event : null;
      await db.update(emailLog).set({ checkedAt: new Date(), ...(ev ? { lastEvent: ev, lastEventAt: new Date() } : {}) }).where(eq(emailLog.id, r.id));
      checked++;
    } catch { /* next time */ }
  }
  return { checked };
}

export type EmailStats = { sent: number; delivered: number; opened: number; clicked: number; bounced: number };
const RANK: Record<string, number> = { bounced: -1, complained: -1, sent: 0, delivery_delayed: 0, delivered: 1, opened: 2, clicked: 3 };

/** Sent / delivered / opened / clicked / bounced per step (onboarding key, digest week) for one kind, last `days` days. */
export async function emailStatsByStep(kind: string, days = 90) {
  const db = await getDb();
  const rows = await db.select({ step: emailLog.step, ev: emailLog.lastEvent, n: sql<number>`count(*)::int` }).from(emailLog)
    .where(and(eq(emailLog.kind, kind), gt(emailLog.sentAt, new Date(Date.now() - days * 864e5)))).groupBy(emailLog.step, emailLog.lastEvent);
  const out = new Map<string, EmailStats>();
  for (const r of rows) {
    const k = r.step || "—";
    const s = out.get(k) || { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    const rank = RANK[r.ev || "sent"] ?? 0;
    s.sent += r.n;
    if (rank < 0) s.bounced += r.n;
    if (rank >= 1) s.delivered += r.n;
    if (rank >= 2) s.opened += r.n;
    if (rank >= 3) s.clicked += r.n;
    out.set(k, s);
  }
  return out;
}
