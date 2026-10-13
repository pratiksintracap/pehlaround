import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ndas, notifications, offices, users } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { emailReady, sendRaw, layout, E, esc } from "@/lib/email";

type Msg = { title: string; body?: string | null; link?: string | null; broadcastId?: number };

export { emailReady } from "@/lib/email";

export async function sendEmail(to: string[], m: Msg) {
  const link = m.link || "/dashboard";
  const body = E.h(m.title) + (m.body ? E.p(esc(m.body).replace(/\n/g, "<br>")) : "") + E.btn("Open Pehla Round", link);
  return sendRaw(to, m.title, layout(body, { preheader: m.body?.slice(0, 120) || "" }));
}

/** Notify offices in the app and, if they allow it and email is set up, by email. Returns counts. */
export async function notifyOffices(officeIds: number[], m: Msg, email = true) {
  const ids = [...new Set(officeIds)].filter(Boolean);
  if (!ids.length) return { recipients: 0, emailed: 0 };
  const db = await getDb();
  await db.insert(notifications).values(ids.map((officeId) => ({ officeId, title: m.title, body: m.body ?? null, link: m.link ?? null, broadcastId: m.broadcastId ?? null })));
  let emailed = 0;
  if (email && emailReady()) {
    const os = await db.select({ id: offices.id, consents: offices.consents }).from(offices).where(inArray(offices.id, ids));
    const ok = os.filter((o) => o.consents?.email !== false).map((o) => o.id);
    if (ok.length) {
      const people = await db.select({ email: users.email }).from(users).where(and(inArray(users.officeId, ok), eq(users.disabled, false)));
      emailed = await sendEmail(people.map((p) => p.email), m);
    }
  }
  return { recipients: ids.length, emailed };
}

/** Every office that has signed this deal's NDA. */
export async function ndaOffices(dealId: number) {
  const db = await getDb();
  return (await db.select({ o: ndas.officeId }).from(ndas).where(and(eq(ndas.dealId, dealId), isNull(ndas.revokedAt)))).map((r) => r.o);
}

/** Tell the desk: shows in the admin bell, and emails the desk address if set up. */
export async function notifyDesk(m: Msg) {
  const db = await getDb();
  await db.insert(notifications).values({ toAdmin: true, title: m.title, body: m.body ?? null, link: m.link ?? null });
  const s = await getSettings();
  if (s.notifyDeskEmail) await sendEmail([s.notifyDeskEmail], m);
}

/** Unread count for the bell: an office's messages, or the desk's alerts for an admin. */
export async function unreadCount(user: { role: string; office?: { id: number } | null } | null) {
  if (!user) return 0;
  const db = await getDb();
  const where = user.role === "admin" ? and(eq(notifications.toAdmin, true), isNull(notifications.readAt))
    : user.office ? and(eq(notifications.officeId, user.office.id), isNull(notifications.readAt)) : null;
  if (!where) return 0;
  return (await db.select({ id: notifications.id }).from(notifications).where(where)).length;
}
