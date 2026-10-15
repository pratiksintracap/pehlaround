import "server-only";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { articles, emailLog, offices, subscribers, users } from "@/db/schema";
import { E, esc, layout, sendRaw, emailReady } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { artDate, artHref } from "@/lib/articles";
import { getSettings } from "@/lib/settings";
import { track, readSource } from "@/lib/track";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PUBLIC_FOOTER = "You asked for the desk's articles by email on beforethebell.in. Before the Bell is operated by SintraCap Advisors LLP, Lower Parel, Mumbai. Nothing in this email is an offer or advice; investments in unlisted companies can lose their entire value.";
const unsubLink = (token: string) => `${SITE_URL}/api/unsubscribe?s=${token}`;

/** Adds (or re-activates) a public subscriber and sends the one confirmation email. */
export async function subscribe(emailRaw: string, nameRaw: string) {
  const email = emailRaw.trim().toLowerCase(), name = nameRaw.trim().slice(0, 120) || null;
  if (!EMAIL.test(email)) return { ok: false as const, error: "Please enter a valid email address." };
  const db = await getDb();
  const [cur] = await db.select().from(subscribers).where(eq(subscribers.email, email));
  let token = cur?.token;
  if (cur && !cur.unsubscribedAt) return { ok: true as const, already: true };
  if (cur) await db.update(subscribers).set({ unsubscribedAt: null, name: name ?? cur.name }).where(eq(subscribers.id, cur.id));
  else {
    token = randomBytes(18).toString("base64url");
    await db.insert(subscribers).values({ email, name, token, source: await readSource() });
  }
  await track("subscribed", { meta: { email } });
  const latest = (await db.select().from(articles).where(eq(articles.published, true)).orderBy(sql`${articles.publishedAt} desc`).limit(3));
  const body = E.h(`You're on the list${name ? `, ${esc(name.split(" ")[0])}` : ""}`)
    + E.p("The desk's articles will reach you by email, about one a week: short reads on IPOs, private rounds and the market, written for family offices and investors.")
    + (latest.length ? E.p("<b>Recent pieces</b>") + latest.map((a) => `<p style="margin:0 0 10px;font-size:15px;line-height:1.5"><a href="${esc(abs(artHref(a)))}" style="color:#1f4fff;font-weight:bold">${esc(a.title)}</a><br><span style="color:#6b7590;font-size:13px">${artDate(a.publishedAt, true)}</span></p>`).join("") : "")
    + E.p("Family offices, funds and qualified investors can also register on Before the Bell to see the companies on the desk by name. <a href=\"" + SITE_URL + "/register\" style=\"color:#1f4fff\">Register</a>.");
  await sendRaw([email], "Articles from the desk: you're on the list", layout(body, { preheader: "About one a week, written for family offices and investors.", footer: PUBLIC_FOOTER, unsubscribeLink: unsubLink(token!), campaign: { medium: "digest", campaign: "subscribe" } }), [], undefined, { kind: "subscribe" });
  return { ok: true as const };
}

const abs = (href: string) => (href.startsWith("http") ? href : SITE_URL + href);

/** Unsubscribes a public subscriber by token. */
export async function unsubscribeToken(token: string) {
  if (!token) return false;
  const db = await getDb();
  const r = await db.update(subscribers).set({ unsubscribedAt: new Date() }).where(eq(subscribers.token, token)).returning({ id: subscribers.id });
  return r.length > 0;
}

/** Monday 9 AM IST: every article published in the last seven days, to public subscribers and to registered offices
 *  that keep email on. Nothing goes out in a week without an article. Each address is sent at most once per week. */
export async function runDigest(opts: { force?: boolean } = {}) {
  if (!emailReady()) return { skipped: "email off" };
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  if (!opts.force && ist.getUTCDay() !== 1) return { skipped: "not Monday" };
  const db = await getDb();
  const since = new Date(now.getTime() - 7 * 864e5);
  const fresh = await db.select().from(articles).where(and(eq(articles.published, true), gt(articles.publishedAt, since))).orderBy(sql`${articles.publishedAt} desc`);
  if (!fresh.length) return { skipped: "no new articles" };
  const st = await getSettings();
  const weekKey = ist.toISOString().slice(0, 10);
  const lead = fresh[0];
  const subject = fresh.length === 1 ? lead.title : `${lead.title} and ${fresh.length - 1} more`;
  const items = fresh.map((a) => `<a href="${esc(abs(artHref(a)))}" style="display:block;text-decoration:none;border:1px solid #e3e7ef;border-radius:12px;padding:12px 14px;margin:0 0 10px;background:#ffffff"><b style="color:#0b1730;font-size:15px">${esc(a.title)}</b>${a.dek ? `<br><span style="color:#3b4663;font-size:14px;line-height:1.5">${esc(a.dek)}</span>` : ""}<br><span style="color:#6b7590;font-size:12.5px">${artDate(a.publishedAt, true)}</span></a>`).join("");
  const cutoff = new Date(now.getTime() - 6 * 864e5);
  let sent = 0;
  // Public subscribers.
  const subs = await db.select().from(subscribers).where(and(isNull(subscribers.unsubscribedAt), or(isNull(subscribers.lastSentAt), lt(subscribers.lastSentAt, cutoff))));
  for (const s of subs) {
    const body = E.h("This week from the desk") + E.p(`${fresh.length === 1 ? "One new piece" : `${fresh.length} new pieces`} since last week.`) + items
      + E.p(`Approved investors see the companies behind these notes by name on Before the Bell. <a href="${SITE_URL}/register" style="color:#1f4fff">Register</a>.`);
    const ok = await sendRaw([s.email], subject, layout(body, { preheader: lead.dek || lead.title, footer: PUBLIC_FOOTER, unsubscribeLink: unsubLink(s.token), campaign: { medium: "digest", campaign: weekKey } }), [], undefined, { kind: "digest", step: weekKey });
    if (ok) { sent++; await db.update(subscribers).set({ lastSentAt: now }).where(eq(subscribers.id, s.id)); }
  }
  // Registered offices with email on (one email per user), unless the onboarding series is paused site-wide.
  if (st.onboardingEmails) {
    const team = await db.select({ id: users.id, email: users.email, name: users.name, consents: offices.consents }).from(users).innerJoin(offices, eq(offices.id, users.officeId)).where(eq(users.disabled, false));
    const already = new Set((await db.select({ to: emailLog.to }).from(emailLog).where(and(eq(emailLog.kind, "digest"), eq(emailLog.step, weekKey)))).map((r) => r.to));
    for (const u of team) {
      if (u.consents?.email === false || already.has(u.email) || subs.some((s) => s.email === u.email)) continue;
      const body = E.h(`This week from the desk, ${esc(u.name.split(" ")[0])}`) + E.p(`${fresh.length === 1 ? "One new piece" : `${fresh.length} new pieces`} since last week.`) + items + E.btn("Open your dashboard", "/dashboard");
      const ok = await sendRaw([u.email], subject, layout(body, { preheader: lead.dek || lead.title, unsubscribeFor: u.id, campaign: { medium: "digest", campaign: weekKey } }), [], undefined, { kind: "digest", step: weekKey, userId: u.id });
      if (ok) sent++;
    }
  }
  return { sent, articles: fresh.length, week: weekKey };
}
