import "server-only";
// The Monday 9 AM IST summary for each desk member: their overdue and this week's tasks, what the desk finished
// last week, deals that changed stage, and what investors did (allocation requests, call requests, NDAs signed).
// Sent once per Monday (remembered in the settings table), so a re-run the same day sends nothing.
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, calls, deals, interests, ndas, offices, settings, tasks, users } from "@/db/schema";
import { emailReady, sendRaw, layout, E, esc } from "@/lib/email";
import { istDay } from "@/lib/stages";
import { SITE_URL } from "@/lib/site";

const KEY = "deskWeeklySentOn";

export async function runDeskWeekly(now = new Date(), force = false) {
  const today = istDay(now);
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  if (!force && ist.getUTCDay() !== 1) return { skipped: "not Monday" };
  const db = await getDb();
  const [last] = await db.select().from(settings).where(eq(settings.key, KEY));
  if (!force && last?.value === today) return { skipped: "already sent today" };
  const weekAgo = new Date(now.getTime() - 7 * 86400e3);
  const inAWeek = new Date(now.getTime() + 5.5 * 3600e3 + 7 * 86400e3).toISOString().slice(0, 10);

  const people = await db.select({ id: users.id, name: users.name, email: users.email }).from(users)
    .where(and(inArray(users.role, ["admin", "analyst"]), eq(users.disabled, false)));
  const [open, done, moved, asks, callReqs, signed] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.status, "open"), isNotNull(tasks.dueOn), lte(tasks.dueOn, inAWeek))),
    db.select().from(tasks).where(and(eq(tasks.status, "done"), gte(tasks.doneAt, weekAgo))).orderBy(desc(tasks.doneAt)),
    db.select({ action: audit.action, at: audit.at }).from(audit).where(and(gte(audit.at, weekAgo), eq(audit.entity, "deal"), sql`${audit.action} like 'Desk moved %'`)).orderBy(desc(audit.at)),
    db.select({ dealId: interests.dealId, officeId: interests.officeId, amountCr: interests.amountCr }).from(interests).where(gte(interests.createdAt, weekAgo)),
    db.select({ dealId: calls.dealId, officeId: calls.officeId, status: calls.status }).from(calls).where(and(eq(calls.kind, "request"), gte(calls.createdAt, weekAgo))),
    db.select({ n: sql<number>`count(*)::int` }).from(ndas).where(gte(ndas.signedAt, weekAgo)),
  ]);
  const dIds = [...new Set([...open, ...done].map((t) => t.dealId).concat(asks.map((a) => a.dealId), callReqs.map((c) => c.dealId)).filter(Boolean))] as number[];
  const oIds = [...new Set([...asks.map((a) => a.officeId), ...callReqs.map((c) => c.officeId)].filter(Boolean))] as number[];
  const [ds, os] = await Promise.all([
    dIds.length ? db.select({ id: deals.id, company: deals.company }).from(deals).where(inArray(deals.id, dIds)) : Promise.resolve([]),
    oIds.length ? db.select({ id: offices.id, name: offices.name }).from(offices).where(inArray(offices.id, oIds)) : Promise.resolve([]),
  ]);
  const dn = new Map(ds.map((d) => [d.id, d.company])), on = new Map(os.map((o) => [o.id, o.name]));
  const line = (t: (typeof open)[number]) => `<a href="${SITE_URL}/desk/tasks/${t.id}" style="color:#0b1730"><b>${esc(t.title)}</b></a>${t.dealId ? ` · ${esc(dn.get(t.dealId) ?? "")}` : ""}${t.dueOn ? ` · <span style="color:${t.dueOn < today ? "#c0392b" : "#6b7590"}">${t.dueOn < today ? "overdue since" : "due"} ${esc(t.dueOn)}</span>` : ""}`;

  let sent = 0;
  for (const p of people) {
    const mine = open.filter((t) => t.assigneeId === p.id).sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""));
    const over = mine.filter((t) => t.dueOn! < today), week = mine.filter((t) => t.dueOn! >= today);
    const parts = [E.h(`Your desk week: ${over.length} overdue, ${week.length} due this week`), E.p(`Good morning ${esc(p.name.split(" ")[0])}.`)];
    if (over.length) parts.push(E.p("<b>Overdue</b>"), E.list(over.map(line)));
    if (week.length) parts.push(E.p("<b>Due in the next seven days</b>"), E.list(week.map(line)));
    if (!mine.length) parts.push(E.p("Nothing of yours is due this week."));
    parts.push(E.p(`<b>Done on the desk last week: ${done.length}</b>`));
    if (done.length) parts.push(E.list(done.slice(0, 12).map((t) => `${esc(t.title)}${t.dealId ? ` · ${esc(dn.get(t.dealId) ?? "")}` : ""}${t.doneBy ? ` · ${esc(t.doneBy)}` : ""}`)));
    if (moved.length) parts.push(E.p("<b>Deals that moved</b>"), E.list(moved.slice(0, 12).map((m) => esc(m.action.replace(/^Desk moved /, "")))));
    const inv = [
      asks.length ? `${asks.length} allocation request${asks.length === 1 ? "" : "s"}: ${asks.slice(0, 6).map((a) => `${esc(on.get(a.officeId!) ?? "an office")} ₹${Number(a.amountCr)} Cr in ${esc(dn.get(a.dealId) ?? "")}`).join("; ")}` : "",
      callReqs.length ? `${callReqs.length} management call request${callReqs.length === 1 ? "" : "s"}` : "",
      signed[0]?.n ? `${signed[0].n} NDA${signed[0].n === 1 ? "" : "s"} signed` : "",
    ].filter(Boolean);
    parts.push(E.p("<b>Investors last week</b>"), inv.length ? E.list(inv) : E.p("No new requests or NDAs."));
    parts.push(E.btn("Open the desk", "/desk"));
    if (emailReady()) {
      await sendRaw([p.email], `Desk week: ${over.length} overdue, ${week.length} due`, layout(parts.join(""), { preheader: `${over.length} overdue · ${week.length} due · ${done.length} done last week`, campaign: { medium: "desk", campaign: "weekly" } }), [], undefined, { kind: "desk-weekly", userId: p.id }).catch(() => null);
      sent++;
    }
  }
  await db.insert(settings).values({ key: KEY, value: today }).onConflictDoUpdate({ target: settings.key, set: { value: today, updatedAt: new Date() } });
  return { people: sent };
}
