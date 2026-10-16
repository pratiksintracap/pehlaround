import "server-only";
import { and, eq, isNull, lte, isNotNull, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deskInvites, users } from "@/db/schema";
import { sendRaw, emailReady } from "@/lib/email";
import { inviteFollowUpEmail } from "@/lib/invite-mail";
import { listDeals } from "@/lib/deals";

/** Run by the daily 9 AM job: one reminder to each desk invitation emailed 3 or more days ago that nobody has
 *  used yet. Office referrals are left alone (the referring office follows up). At most 50 a day, so the job stays inside its time limit. */
export async function runInviteFollowUps(now = new Date()) {
  if (!emailReady()) return { sent: 0, skipped: "email not set up" };
  const db = await getDb();
  // Counted in days, not hours: an invitation sent any time on Friday is reminded on Monday's 9 AM run.
  const cutoff = new Date(now.getTime() - 2.5 * 24 * 3600 * 1000);
  const rows = await db.select().from(deskInvites).where(and(isNull(deskInvites.usedAt), isNull(deskInvites.followedUpAt),
    isNull(deskInvites.referrerOfficeId), isNotNull(deskInvites.emailedAt), lte(deskInvites.emailedAt, cutoff))).limit(50);
  if (!rows.length) return { sent: 0 };
  // Someone may have registered directly, without the link: do not remind them.
  const registered = new Set((await db.select({ e: users.email }).from(users).where(inArray(users.email, rows.map((r) => r.email)))).map((r) => r.e));
  const open = (await listDeals()).filter((d) => d.open);
  const best = [...open].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  let sent = 0, i = 0;
  for (const r of rows) {
    if (registered.has(r.email)) { await db.update(deskInvites).set({ followedUpAt: now }).where(eq(deskInvites.id, r.id)); continue; }
    const deal = best.length ? best[i++ % Math.min(best.length, 3)] : null; // rotate among the top three
    const office = /\.[a-z]{2,}$/i.test(r.officeName || "") ? "" : r.officeName;
    const m = inviteFollowUpEmail({ name: r.name, officeName: office, token: r.token, open: open.length,
      deal: deal ? { title: deal.title, category: deal.category, listingLabel: deal.listingLabel, score: deal.score, headline: deal.headline } : null });
    const ok = await sendRaw([r.email], m.subject, m.html, [], undefined, { kind: "invite_followup" });
    if (ok) { sent++; await db.update(deskInvites).set({ followedUpAt: now }).where(eq(deskInvites.id, r.id)); }
    await new Promise((res) => setTimeout(res, 520));
  }
  return { sent, due: rows.length };
}
