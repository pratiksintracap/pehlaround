import "server-only";
import { and, asc, desc, eq, gt, inArray, lte, notInArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { articles, deals, emailQueue, interests, ndas, offices, users } from "@/db/schema";
import { E, emailReady, layout, sendRaw } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { artHref } from "@/lib/articles";

// ---------------------------------------------------------------- the series
// Each step: when it goes (days after registration or approval, at 9 AM IST; day 0 = straight away),
// what it says, and when it is skipped because the office already did the thing it asks for.

type Ctx = {
  user: typeof users.$inferSelect; office: typeof offices.$inferSelect;
  deals: (typeof deals.$inferSelect)[]; newDeals: (typeof deals.$inferSelect)[];
  arts: (typeof articles.$inferSelect)[]; ndaCount: number; interestCount: number; teamSize: number;
};
type Step = { key: string; anchor: "register" | "approved"; days: number; name: string; purpose: string;
  subject: (c: Ctx) => string; preheader: (c: Ctx) => string; body: (c: Ctx) => string; skip?: (c: Ctx) => string | null; signature?: string };

const first = (c: Ctx) => c.user.name.split(" ")[0];
const dealList = (list: Ctx["deals"]) => list.map((d) => E.deal(d.title, `${d.category} · target listing ${d.listingLabel}`, d.score, `/deals/${d.slug}`)).join("");
const PRATIK = `<p style="margin:18px 0 0;font-size:14px;color:#3b4663">Pratik Saraogi<br>CEO, Off Market Desk</p>`;

export const SERIES: Step[] = [
  { key: "welcome", anchor: "register", days: 0, name: "Welcome", purpose: "Confirms the registration and says what happens next",
    subject: () => "Welcome to Off Market Desk: what happens next",
    preheader: () => "The desk approves new offices within a working day. Here is what opens after that.",
    skip: (c) => (c.office.approval === "approved" ? "already approved" : null),
    body: (c) => E.h(`Welcome, ${first(c)}`)
      + E.p(`Thank you for registering <b>${c.office.name}</b> on Off Market Desk. The desk reviews every new office, usually within a working day, and you will hear from us the moment yours is approved.`)
      + E.p("Once approved, your office sees:")
      + E.list(["Every company on the desk by name, with round size, valuation and trailing and forward P/E", "A deal room for each company, opened with that company's NDA, signed on screen",
        "Questions to the promoter, promoter sessions and allocation requests, all from your dashboard", "A new company about every fortnight, checked by the desk before you see it"])
      + E.p("What is on the desk right now, without names:") + dealList(c.deals.slice(0, 3))
      + E.btn("Open your dashboard", "/dashboard") },
  { key: "approved", anchor: "approved", days: 0, name: "You're in", purpose: "Approval: every company now opens by name",
    subject: () => "You're in: every company on the desk is now open to your office",
    preheader: () => "Names, rounds and valuations are open. Sign a company's NDA on screen to open its room.",
    body: (c) => E.h("Your office is approved")
      + E.p(`${first(c)}, the desk has approved <b>${c.office.name}</b>. Every company on the desk now opens to you by name, with its round, valuation and trailing and forward P/E.`)
      + E.p("The highest Desk Scores on the desk today:") + dealList(c.deals.slice(0, 3))
      + E.p("To open a company's deal room, sign its NDA on screen. Each NDA covers that one company, and the signed copy is emailed to you as a PDF.")
      + E.btn("See every company by name", "/deals") },
  { key: "first_room", anchor: "approved", days: 2, name: "Open your first room", purpose: "Nudge to sign a first NDA",
    subject: () => "Open your first deal room",
    preheader: () => "One NDA, signed on screen, opens the room: numbers, terms, risks and documents.",
    skip: (c) => (c.ndaCount > 0 ? "already signed an NDA" : null),
    body: (c) => { const d = c.deals[0];
      return E.h("Your first deal room is one signature away")
        + E.p(`${first(c)}, every company on the desk has a deal room laid out the same way, so you can compare them side by side. Inside each one:`)
        + E.list(["Audited numbers and projections, side by side", "The round, the terms and the path to listing", "The risks the desk sees, in plain words, with the source", "The data room, and questions to the promoter answered for every office"])
        + (d ? E.p("A good place to start is the highest-scored company on the desk:") + dealList([d]) : "")
        + E.btn("Open a deal room", d ? `/deals/${d.slug}` : "/deals"); } },
  { key: "how_we_pick", anchor: "approved", days: 5, name: "How a company gets on the desk", purpose: "Builds trust in the curation and the Desk Score",
    subject: () => "How a company gets on the desk",
    preheader: () => "Site and plant visits, customer orders checked, and a Desk Score for every company.",
    body: (c) => E.h("Checked before you see it")
      + E.p(`${first(c)}, most companies the desk meets never reach you. Before one gets a room, the desk does its own diligence on it:`)
      + E.list(["Promoter and management meetings", "Site, factory and plant visits", "Customer orders verified, and customer and supplier feedback taken", "Audited numbers reconciled across sources, and the valuation set against listed peers"])
      + E.p("Every company then carries a <b>Desk Score</b> out of 10: the desk's own view of how strongly it fits a first institutional round ahead of its listing. It is not a rating or a recommendation; the findings behind it are in the room.")
      + E.p("Off Market Desk is backed by SintraCap, a family office that invests its own capital.")
      + E.btn("See the scores on the desk", "/deals") },
  { key: "team_app", anchor: "approved", days: 9, name: "Your team, and the app", purpose: "Add CIO/CFO/CA; install the app",
    subject: () => "Bring your CIO, CFO or CA, and put the desk on your phone",
    preheader: () => "Add your team as viewers, and install the app in a few taps.",
    body: (c) => E.h("Two things that make the desk easier")
      + E.p(`<b>Your team.</b> ${c.teamSize > 1 ? `${c.teamSize} people from your office are on the desk already.` : "Add your CIO, CFO or CA as viewers."} They see the same rooms, and every NDA, document view and request is logged against a name.`)
      + E.btn("Add your team", "/dashboard#Team")
      + E.p("<b>The app.</b> Install Off Market Desk on your phone and it opens straight to your dashboard: new deals, promoter answers and approvals arrive as they happen. On iPhone, open the link in Safari; on Android, in Chrome.")
      + E.btn("Get the app", "/app?install=1") },
  { key: "whats_new", anchor: "approved", days: 14, name: "What's new on the desk", purpose: "Fortnight recap: new deals and articles",
    subject: (c) => (c.newDeals.length ? `New on the desk: ${c.newDeals.length} ${c.newDeals.length === 1 ? "company" : "companies"} since you joined` : "Your fortnight on the desk"),
    preheader: () => "A new company reaches the desk about every fortnight. Here is the latest, and what we have been reading.",
    body: (c) => E.h("What's new on the desk")
      + (c.newDeals.length ? E.p(`${first(c)}, ${c.newDeals.length === 1 ? "a new company has" : "new companies have"} reached the desk since your office joined:`) + dealList(c.newDeals.slice(0, 4))
        : E.p(`${first(c)}, a new company reaches the desk about every fortnight. The companies on the desk today:`) + dealList(c.deals.slice(0, 3)))
      + (c.arts.length ? E.p("From the desk's articles:") + E.list(c.arts.map((a) => E.a(a.title, artHref(a)))) : "")
      + E.btn("Open your dashboard", "/dashboard") },
  { key: "personal", anchor: "approved", days: 21, name: "A note from Pratik", purpose: "Personal check-in if no allocation requested yet",
    subject: () => "Anything I can help with?",
    preheader: () => "If a deal is close to your mandate, happy to set up a call with the promoter.",
    skip: (c) => (c.interestCount > 0 ? "already requested an allocation" : null),
    signature: PRATIK,
    body: (c) => E.p(`Dear ${first(c)},`)
      + E.p(`It has been three weeks since ${c.office.name} joined the desk, and I wanted to check in personally.`)
      + E.p("If any company on the desk is close to your mandate, I am happy to set up a call with the promoter, or walk you through what the desk found. If none is, tell me what you are looking for: sector, ticket size, time to listing. It shapes what we bring next.")
      + E.p("Just reply to this email; it comes straight to me.") },
];

// ---------------------------------------------------------------- scheduling
/** 9:00 AM IST, `days` after `from` (IST calendar days). */
function nineAmIst(from: Date, days: number) {
  const ist = new Date(from.getTime() + 330 * 60e3);
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days, 3, 30)); // 03:30 UTC = 09:00 IST
  return d;
}

/** Queue a person's steps for an anchor ("register" or "approved"); day-0 steps go out straight away. */
export async function startSeries(userId: number, anchor: "register" | "approved", at = new Date()) {
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return;
  for (const s of SERIES.filter((x) => x.anchor === anchor)) {
    await db.insert(emailQueue).values({ userId, officeId: u.officeId, step: s.key, sendAt: s.days === 0 ? at : nineAmIst(at, s.days) }).onConflictDoNothing();
  }
  await runDue({ userId, immediateOnly: true });
}

async function context(userId: number): Promise<Ctx | null> {
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.officeId) return null;
  const [office] = await db.select().from(offices).where(eq(offices.id, user.officeId));
  const all = (await db.select().from(deals).where(eq(deals.published, true))).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const since = office.approvedAt ?? office.createdAt;
  const [arts, nd, it, team] = await Promise.all([
    db.select().from(articles).where(eq(articles.published, true)).orderBy(desc(articles.publishedAt)).limit(3),
    db.select({ n: sql<number>`count(*)::int` }).from(ndas).where(eq(ndas.officeId, office.id)),
    db.select({ n: sql<number>`count(*)::int` }).from(interests).where(eq(interests.officeId, office.id)),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.officeId, office.id)),
  ]);
  return { user, office, deals: all, newDeals: all.filter((d) => d.updatedAt > since && d.open), arts, ndaCount: nd[0].n, interestCount: it[0].n, teamSize: team[0].n };
}

export function render(step: Step, c: Ctx) {
  return { subject: step.subject(c), html: layout(step.body(c), { preheader: step.preheader(c), unsubscribeFor: c.user.id, signature: step.signature }) };
}

/** Send what is due. Called by the daily 9 AM run, and straight after registration or approval for day-0 steps. */
export async function runDue(opts: { userId?: number; immediateOnly?: boolean } = {}) {
  if (!emailReady()) return { sent: 0, skipped: 0, waiting: true };
  const st = await getSettings();
  if (!st.onboardingEmails) return { sent: 0, skipped: 0, off: true };
  const db = await getDb();
  const now = new Date();
  const conds = [eq(emailQueue.status, "pending"), lte(emailQueue.sendAt, now)];
  if (opts.userId) conds.push(eq(emailQueue.userId, opts.userId));
  const due = await db.select().from(emailQueue).where(and(...conds)).orderBy(asc(emailQueue.sendAt)).limit(200);
  let sent = 0, skipped = 0;
  for (const q of due) {
    const step = SERIES.find((s) => s.key === q.step);
    const mark = (status: string, reason: string | null) => db.update(emailQueue).set({ status, reason, sentAt: status === "sent" ? new Date() : null }).where(eq(emailQueue.id, q.id));
    if (opts.immediateOnly && step && step.days !== 0) continue;
    if (!step) { await mark("skipped", "step removed"); skipped++; continue; }
    if (now.getTime() - q.sendAt.getTime() > 4 * 864e5) { await mark("skipped", "too late to send"); skipped++; continue; }
    const c = await context(q.userId);
    if (!c || c.user.disabled) { await mark("skipped", "person not active"); skipped++; continue; }
    if (step.anchor === "approved" && c.office.approval !== "approved") { await mark("skipped", "office not approved"); skipped++; continue; }
    if (step.key !== "approved" && c.office.consents?.email === false) { await mark("skipped", "office turned emails off"); skipped++; continue; }
    const why = step.skip?.(c);
    if (why) { await mark("skipped", why); skipped++; continue; }
    const { subject, html } = render(step, c);
    const ok = await sendRaw([c.user.email], subject, html);
    if (ok) { await mark("sent", null); sent++; }
  }
  return { sent, skipped };
}

/** A preview with sample data, for the admin. */
export async function preview(key: string) {
  const step = SERIES.find((s) => s.key === key);
  if (!step) return null;
  const db = await getDb();
  const all = (await db.select().from(deals).where(eq(deals.published, true))).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const arts = await db.select().from(articles).where(eq(articles.published, true)).orderBy(desc(articles.publishedAt)).limit(3);
  const now = new Date();
  const c: Ctx = {
    user: { id: 0, name: "Sanjay Shah", email: "sanjay@example.com" } as unknown as Ctx["user"],
    office: { id: 0, name: "Shah Family Office", approval: "approved", consents: { email: true }, createdAt: now, approvedAt: now } as unknown as Ctx["office"],
    deals: all, newDeals: all.slice(0, 2), arts, ndaCount: 0, interestCount: 0, teamSize: 1,
  };
  return { step, ...render(step, c) };
}

export async function queueStats() {
  const db = await getDb();
  const rows = await db.select({ step: emailQueue.step, status: emailQueue.status, n: sql<number>`count(*)::int` }).from(emailQueue).groupBy(emailQueue.step, emailQueue.status);
  const m = new Map<string, Record<string, number>>();
  for (const r of rows) { const o = m.get(r.step) || {}; o[r.status] = r.n; m.set(r.step, o); }
  return m;
}

/** Start the series for people who registered before it existed: only future steps, never the past ones. */
export async function backfill() {
  const db = await getDb();
  const people = await db.select({ id: users.id, officeId: users.officeId }).from(users).where(and(notInArray(users.role, ["admin", "analyst"]), gt(users.id, 0)));
  const offs = people.length ? await db.select().from(offices).where(inArray(offices.id, people.map((p) => p.officeId!).filter(Boolean))) : [];
  let n = 0;
  for (const p of people) {
    const o = offs.find((x) => x.id === p.officeId); if (!o || o.approval !== "approved" || !o.approvedAt) continue;
    for (const s of SERIES.filter((x) => x.anchor === "approved" && x.days > 0)) {
      const at = nineAmIst(o.approvedAt, s.days);
      if (at > new Date()) { await db.insert(emailQueue).values({ userId: p.id, officeId: o.id, step: s.key, sendAt: at }).onConflictDoNothing(); n++; }
    }
  }
  return n;
}
