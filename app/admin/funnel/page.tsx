import { desc, eq, gt, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { events, interests, ndas, offices, subscribers } from "@/db/schema";
import { sourceLabel } from "@/lib/source";
import { emailStatsByStep } from "@/lib/email-status";
import { SERIES } from "@/lib/onboarding";

const WEEKS = 8;
const IST = 5.5 * 3600e3;
/** Monday 00:00 IST of the week containing d, as a UTC timestamp. */
function weekStart(d: Date) {
  const t = new Date(d.getTime() + IST);
  const day = (t.getUTCDay() + 6) % 7;
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - day) - IST;
}
const fmtW = (ms: number) => new Date(ms + IST).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default async function Funnel() {
  await requireAdmin();
  const db = await getDb();
  const now = new Date();
  const from = new Date(weekStart(now) - (WEEKS - 1) * 7 * 864e5);
  const [offs, ndaRows, intRows, evRows, subCount, refTop] = await Promise.all([
    db.select({ id: offices.id, name: offices.name, source: offices.source, approval: offices.approval, createdAt: offices.createdAt, approvedAt: offices.approvedAt, referredBy: offices.referredBy }).from(offices).orderBy(desc(offices.createdAt)),
    db.select({ officeId: ndas.officeId, at: ndas.signedAt }).from(ndas),
    db.select({ officeId: interests.officeId, at: interests.createdAt }).from(interests),
    db.select({ kind: events.kind, at: events.at, source: events.source, meta: events.meta }).from(events).where(gt(events.at, from)),
    db.select({ n: sql<number>`count(*)::int` }).from(subscribers).where(sql`${subscribers.unsubscribedAt} is null`).then((r) => r[0]?.n ?? 0),
    db.select({ id: offices.referredBy, n: sql<number>`count(*)::int` }).from(offices).where(sql`${offices.referredBy} is not null`).groupBy(offices.referredBy).orderBy(desc(sql`count(*)`)).limit(8),
  ]);
  const nameOf = new Map(offs.map((o) => [o.id, o.name]));
  const firstNda = new Map<number, Date>(), firstInt = new Map<number, Date>();
  for (const r of ndaRows) if (!firstNda.has(r.officeId) || firstNda.get(r.officeId)! > r.at) firstNda.set(r.officeId, r.at);
  for (const r of intRows) if (!firstInt.has(r.officeId) || firstInt.get(r.officeId)! > r.at) firstInt.set(r.officeId, r.at);

  // Weekly: by the week each step happened.
  const weeks = Array.from({ length: WEEKS }, (_, i) => from.getTime() + i * 7 * 864e5);
  const wk = (d: Date | null | undefined) => (d ? weeks.findIndex((w) => d.getTime() >= w && d.getTime() < w + 7 * 864e5) : -1);
  const rows = weeks.map((w) => ({ w, visits: 0, registered: 0, approved: 0, nda: 0, allocation: 0, subscribed: 0 }));
  for (const o of offs) { const a = wk(o.createdAt); if (a >= 0) rows[a].registered++; const b = wk(o.approvedAt); if (b >= 0) rows[b].approved++; }
  for (const d of firstNda.values()) { const i = wk(d); if (i >= 0) rows[i].nda++; }
  for (const d of firstInt.values()) { const i = wk(d); if (i >= 0) rows[i].allocation++; }
  for (const e of evRows) { const i = wk(e.at); if (i < 0) continue; if (e.kind === "register_started") rows[i].visits++; if (e.kind === "subscribed") rows[i].subscribed++; }
  const tot = rows.reduce((t, r) => ({ visits: t.visits + r.visits, registered: t.registered + r.registered, approved: t.approved + r.approved, nda: t.nda + r.nda, allocation: t.allocation + r.allocation, subscribed: t.subscribed + r.subscribed }), { visits: 0, registered: 0, approved: 0, nda: 0, allocation: 0, subscribed: 0 });

  // By source: every office, all time, by where it first came from.
  const bySrc = new Map<string, { registered: number; approved: number; nda: number; allocation: number }>();
  for (const o of offs) {
    const k = o.referredBy ? `referral · ${nameOf.get(o.referredBy) || "office"}` : sourceLabel(o.source);
    const s = bySrc.get(k) || { registered: 0, approved: 0, nda: 0, allocation: 0 };
    s.registered++; if (o.approval === "approved") s.approved++; if (firstNda.has(o.id)) s.nda++; if (firstInt.has(o.id)) s.allocation++;
    bySrc.set(k, s);
  }
  const srcRows = [...bySrc.entries()].sort((a, b) => b[1].registered - a[1].registered);
  const visitsBySrc = new Map<string, number>();
  for (const e of evRows) if (e.kind === "register_started") { const k = sourceLabel(e.source); visitsBySrc.set(k, (visitsBySrc.get(k) || 0) + 1); }

  const all = { registered: offs.length, approved: offs.filter((o) => o.approval === "approved").length, nda: firstNda.size, allocation: firstInt.size };
  const stages: [string, number][] = [["Registered", all.registered], ["Approved", all.approved], ["Signed an NDA", all.nda], ["Requested an allocation", all.allocation]];
  const max = Math.max(1, all.registered);
  const onboarding = await emailStatsByStep("onboarding");
  const digest = await emailStatsByStep("digest");
  const stepName = new Map(SERIES.map((s) => [s.key, s.name]));

  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Funnel</h1>
      <p className="fine" style={{ marginBottom: 16, maxWidth: 760 }}>Registrations → approvals → NDAs → allocation requests, by week and by where each office first came from. Visits to the register page are counted once a day per browser; a source is the utm tags, the referring site or an office&apos;s invite link on the first visit.</p>

      <div className="chart funnel" style={{ marginBottom: 18 }}>
        <span className="k">All offices, all time</span>
        <div className="fn-bars">{stages.map(([l, n]) => (<div key={l} style={{ display: "contents" }}><span>{l}</span><span className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></span><b>{n}</b></div>))}</div>
        <p className="fine" style={{ margin: 0 }}>Approved {pct(all.approved, all.registered)} of registered · NDA {pct(all.nda, all.approved)} of approved · allocation {pct(all.allocation, all.nda)} of NDA-signed · {subCount} article subscriber{subCount === 1 ? "" : "s"}.</p>
      </div>

      <h2 style={{ fontSize: 22, margin: "22px 0 10px" }}>By week, last {WEEKS} weeks</h2>
      <div className="cmpwrap"><table className="cmp plain">
        <thead><tr><th>Week of</th><th>Register page visits</th><th>Registered</th><th>Approved</th><th>First NDA</th><th>First allocation request</th><th>Subscribed</th></tr></thead>
        <tbody>{rows.map((r) => (<tr key={r.w}><td className="mono">{fmtW(r.w)}</td><td>{r.visits}</td><td>{r.registered}</td><td>{r.approved}</td><td>{r.nda}</td><td>{r.allocation}</td><td>{r.subscribed}</td></tr>))}
          <tr><td><b>Total</b></td><td><b>{tot.visits}</b></td><td><b>{tot.registered}</b></td><td><b>{tot.approved}</b></td><td><b>{tot.nda}</b></td><td><b>{tot.allocation}</b></td><td><b>{tot.subscribed}</b></td></tr></tbody>
      </table></div>

      <h2 style={{ fontSize: 22, margin: "26px 0 10px" }}>By source</h2>
      <p className="fine" style={{ marginBottom: 10 }}>Where each office first came from. Visits are from the last {WEEKS} weeks; offices are all time. &quot;direct&quot; is a typed address, a bookmark, or an app that hides the referrer (WhatsApp does).</p>
      {srcRows.length ? <div className="cmpwrap"><table className="cmp plain">
        <thead><tr><th>Source</th><th>Visits</th><th>Registered</th><th>Approved</th><th>NDA</th><th>Allocation</th></tr></thead>
        <tbody>{srcRows.map(([k, s]) => (<tr key={k}><td>{k}</td><td>{visitsBySrc.get(k) ?? 0}</td><td>{s.registered}</td><td>{s.approved}</td><td>{s.nda}</td><td>{s.allocation}</td></tr>))}</tbody>
      </table></div> : <p className="fine">No offices yet.</p>}

      {refTop.length > 0 && <>
        <h2 style={{ fontSize: 22, margin: "26px 0 10px" }}>Referrals</h2>
        <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Referring office</th><th>Offices brought in</th></tr></thead>
          <tbody>{refTop.map((r) => (<tr key={r.id}><td>{nameOf.get(r.id!) || `Office #${r.id}`}</td><td>{r.n}</td></tr>))}</tbody></table></div>
      </>}

      <h2 style={{ fontSize: 22, margin: "26px 0 10px" }}>Emails, last 90 days</h2>
      <p className="fine" style={{ marginBottom: 10 }}>Delivery from Resend, refreshed with the daily 9 AM run. Opens need the recipient&apos;s mail app to load images, so clicks are the surer signal.</p>
      <div className="cmpwrap"><table className="cmp plain">
        <thead><tr><th>Email</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Bounced</th></tr></thead>
        <tbody>
          {SERIES.map((s) => { const k = onboarding.get(s.key); return k ? (<tr key={s.key}><td>{s.name}</td><td>{k.sent}</td><td>{k.delivered} <span className="fine">{pct(k.delivered, k.sent)}</span></td><td>{k.opened} <span className="fine">{pct(k.opened, k.sent)}</span></td><td>{k.clicked} <span className="fine">{pct(k.clicked, k.sent)}</span></td><td>{k.bounced}</td></tr>) : null; })}
          {[...digest.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([w, k]) => (<tr key={w}><td>Digest · week of {w}</td><td>{k.sent}</td><td>{k.delivered} <span className="fine">{pct(k.delivered, k.sent)}</span></td><td>{k.opened} <span className="fine">{pct(k.opened, k.sent)}</span></td><td>{k.clicked} <span className="fine">{pct(k.clicked, k.sent)}</span></td><td>{k.bounced}</td></tr>))}
          {!onboarding.size && !digest.size && <tr><td colSpan={6} className="fine">Nothing sent in the last 90 days.</td></tr>}
        </tbody>
      </table></div>
      <p className="fine" style={{ marginTop: 8 }}>{[...stepName.keys()].length} onboarding steps are tracked; sign-in codes, NDA copies and desk notices are logged but not shown here.</p>
    </>
  );
}
