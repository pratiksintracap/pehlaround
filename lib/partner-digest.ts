import "server-only";
// The Monday 9 AM IST note to each partner firm's principals: where the firm stands against the targets the desk set,
// the issues open now, the clients who joined last week and any IPO interest still waiting for a client to confirm.
// Sent once per Monday (remembered in the settings table) and only to firms with something to report. Never a fee,
// a commission or another firm's numbers. Switched off under Settings.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { interests, ipoBids, ndas, offices, partnerTargets, settings, users } from "@/db/schema";
import { emailReady, sendRaw, layout, E, esc } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { istDay } from "@/lib/stages";
import { listDeals } from "@/lib/deals";
import { fmtCr, progress, tally, type Client } from "@/lib/partner-math";
import { AWAITING, counts, fmtAmount, ipoStage, ipoVisible } from "@/lib/ipo";

const KEY = "partnerDigestSentOn";

export async function runPartnerDigest(now = new Date(), force = false) {
  const today = istDay(now);
  if (!force && new Date(now.getTime() + 5.5 * 3600e3).getUTCDay() !== 1) return { skipped: "not Monday" };
  if (!(await getSettings()).partnerDigest) return { skipped: "switched off" };
  if (!emailReady()) return { skipped: "email not set up" };
  const db = await getDb();
  const [last] = await db.select().from(settings).where(eq(settings.key, KEY));
  if (!force && last?.value === today) return { skipped: "already sent today" };
  const weekAgo = new Date(now.getTime() - 7 * 86400e3);

  const firms = (await db.select().from(offices).where(and(eq(offices.investorType, "broker"), eq(offices.approval, "approved")))).filter((f) => f.consents?.email !== false);
  if (!firms.length) return { sent: 0, firms: 0 };
  const fIds = firms.map((f) => f.id);
  const [people, clients, targets, all] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, rights: users.rights, officeId: users.officeId }).from(users).where(and(inArray(users.officeId, fIds), eq(users.disabled, false))),
    db.select({ id: offices.id, name: offices.name, approval: offices.approval, createdAt: offices.createdAt, rmId: offices.referredByUserId, firm: offices.referredBy }).from(offices).where(inArray(offices.referredBy, fIds)),
    db.select().from(partnerTargets).where(inArray(partnerTargets.officeId, fIds)),
    listDeals(true),
  ]);
  const cIds = clients.map((c) => c.id);
  const [cNdas, cAsks, cBids] = cIds.length ? await Promise.all([
    db.select({ officeId: ndas.officeId, dealId: ndas.dealId, signedAt: ndas.signedAt }).from(ndas).where(and(inArray(ndas.officeId, cIds), isNull(ndas.revokedAt))),
    db.select({ officeId: interests.officeId, dealId: interests.dealId, amountCr: interests.amountCr, status: interests.status }).from(interests).where(inArray(interests.officeId, cIds)),
    db.select({ officeId: ipoBids.officeId, dealId: ipoBids.dealId, amountCr: ipoBids.amountCr, status: ipoBids.status }).from(ipoBids).where(inArray(ipoBids.officeId, cIds)),
  ]) : [[], [], []];
  const open = all.filter((d) => d.phase === "open"), ipos = ipoVisible(all, now).filter((d) => ipoStage(d.ipo, now) === "open");
  const name = new Map(all.map((d) => [d.id, d.company]));

  let sent = 0, told = 0;
  for (const f of firms) {
    const to = people.filter((p) => p.officeId === f.id && /commit/i.test(p.rights));
    const fc: Client[] = clients.filter((c) => c.firm === f.id), ft = targets.filter((t) => t.officeId === f.id);
    if (!to.length || (!fc.length && !ft.length)) continue; // nothing to report: no note
    const fcIds = new Set(fc.map((c) => c.id));
    const totals = tally(fc, cNdas, cAsks);
    const fresh = fc.filter((c) => c.createdAt >= weekAgo);
    const waiting = cBids.filter((b) => fcIds.has(b.officeId) && b.status === AWAITING);
    const parts = [E.h(`${f.name}: your week on Before the Bell`),
      E.p(`${totals.clients} client${totals.clients === 1 ? "" : "s"} on the desk, ${totals.approved} approved · ${totals.intros} introduction${totals.intros === 1 ? "" : "s"} · ${fmtCr(totals.indicatedCr)} requested · ${fmtCr(totals.allottedCr)} allotted.`)];
    const lines = ft.filter((t) => name.has(t.dealId)).map((t) => {
      const what = [t.intros ? `${t.intros} ${t.leg === "ipo" ? "clients" : "introductions"}` : "", t.amountCr ? fmtCr(t.amountCr) : ""].filter(Boolean).join(" and ");
      if (t.leg === "ipo") { const b = cBids.filter((x) => fcIds.has(x.officeId) && x.dealId === t.dealId && counts(x)); const amt = b.reduce((s, x) => s + Number(x.amountCr), 0); const p = progress(t, { intros: b.length, indicatedCr: amt });
        return `<b>${esc(name.get(t.dealId))} IPO</b>: target ${esc(what)} · so far ${b.length} client${b.length === 1 ? "" : "s"}, ${esc(fmtAmount(amt))}${p !== null ? ` · ${Math.round(p * 100)}%` : ""}`; }
      const c = tally(fc, cNdas, cAsks, t.dealId), p = progress(t, c);
      return `<b>${esc(name.get(t.dealId))}</b>: target ${esc(what)} · so far ${c.intros} introduction${c.intros === 1 ? "" : "s"}, ${esc(fmtCr(c.indicatedCr))} requested${p !== null ? ` · ${Math.round(p * 100)}%` : ""}`; });
    if (lines.length) parts.push(E.p("<b>Against your targets</b>"), E.list(lines));
    if (fresh.length) parts.push(E.p(`<b>Joined last week: ${fresh.length}</b>`), E.list(fresh.slice(0, 15).map((c) => `${esc(c.name)}${c.approval === "approved" ? "" : " · awaiting the desk's approval"}`)));
    if (waiting.length) parts.push(E.p(`<b>Waiting for your clients to confirm: ${waiting.length}</b>`), E.list(waiting.slice(0, 15).map((b) => `${esc(fc.find((c) => c.id === b.officeId)?.name)} · ${esc(name.get(b.dealId) ?? "")} IPO · ${esc(fmtAmount(b.amountCr))}`)), E.p("A reminder from you helps: the interest counts only once the client confirms it."));
    const live = [open.length ? `${open.length} round${open.length === 1 ? "" : "s"} open` : "", ipos.length ? `${ipos.length} IPO${ipos.length === 1 ? "" : "s"} open for interest` : ""].filter(Boolean).join(" and ");
    parts.push(E.p(live ? `On the desk now: ${live}. Your link for each is on the partner desk.` : "No round is open on the desk this week."), E.btn("Open the partner desk", "/dashboard/partner"),
      E.p(`<span style="color:#6b7590;font-size:13px">Sent on Mondays to your firm's principals. To stop it, switch off email under Team on your dashboard.</span>`));
    const html = layout(parts.join(""), { preheader: `${totals.intros} introductions, ${fmtCr(totals.indicatedCr)} requested`, campaign: { medium: "email", campaign: "partner-weekly" } });
    const ok = await sendRaw(to.map((p) => p.email), `${f.name}: your week on Before the Bell`, html, [], undefined, { kind: "partner-digest", step: today, officeId: f.id });
    if (ok) { sent++; told += to.length; }
  }
  await db.insert(settings).values({ key: KEY, value: today }).onConflictDoUpdate({ target: settings.key, set: { value: today, updatedAt: new Date() } });
  return { sent, people: told, firms: firms.length };
}
