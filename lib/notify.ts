import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ndas, notifications, offices, users } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { SITE_URL } from "@/lib/site";

type Msg = { title: string; body?: string | null; link?: string | null; broadcastId?: number };

/** True when an email provider is configured (Resend). */
export const emailReady = () => !!process.env.RESEND_API_KEY;

async function sendEmail(to: string[], m: Msg) {
  if (!emailReady() || !to.length) return 0;
  const from = process.env.EMAIL_FROM || "Pehla Round <desk@pehlaround.in>";
  const url = m.link ? (m.link.startsWith("http") ? m.link : SITE_URL + m.link) : SITE_URL + "/dashboard";
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#0b1730"><p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7590">Pehla Round</p><h2 style="margin:0 0 10px">${esc(m.title)}</h2>${m.body ? `<p style="line-height:1.55">${esc(m.body).replace(/\n/g, "<br>")}</p>` : ""}<p><a href="${url}" style="background:#1f4fff;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Pehla Round</a></p><p style="font-size:12px;color:#6b7590">You receive this because your family office is registered on Pehla Round. Manage email alerts in your dashboard under Team and profile.</p></div>`;
  let sent = 0;
  for (const addr of to) {
    try {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: addr, subject: m.title, html }) });
      if (r.ok) sent++;
    } catch { /* email is best-effort; the in-app notification is the record */ }
  }
  return sent;
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
