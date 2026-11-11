import { desc, eq, inArray } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { isSuper, can, mask } from "@/lib/perm";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { deals, ipoBids, offices, partnerTargets, users } from "@/db/schema";
import { saveIpoBid } from "@/lib/desk-actions";
import { hiddenOffices } from "@/lib/desk";
import { IPO_CATEGORY, IPO_STATUS, fmtAmount, ipoStage, type IpoCategory } from "@/lib/ipo";
import { fmtIso } from "@/lib/closing";

const STAGE: Record<string, [string, string]> = { open: ["Open for interest", "ok"], closed: ["Issue closed, listing awaited", "mid"], listed: ["Listed", ""], none: ["Prospectus not filed", ""] };
const sum = (xs: { amountCr: string }[]) => Math.round(xs.reduce((t, x) => t + Number(x.amountCr), 0) * 10000) / 10000;

/** The IPO book: for each company whose price-band prospectus is filed, the interest offices registered, by category
 *  and by the partner firm that introduced them. Desk only; the lead manager gets the export. */
export default async function IpoBook() {
  const me = await requireDesk();
  const move = isSuper(me), seeContacts = can(me, "contacts.view", { analystContacts: (await getSettings()).analystContacts });
  const db = await getDb();
  const all = await db.select({ id: deals.id, company: deals.company, slug: deals.slug, ipo: deals.ipo }).from(deals).where(eq(deals.listed, false)).orderBy(deals.sort);
  const issues = all.filter((d) => d.ipo?.rhp);
  const ids = issues.map((d) => d.id);
  const hidden = await hiddenOffices(me);
  const bids = ids.length ? (await db.select().from(ipoBids).where(inArray(ipoBids.dealId, ids)).orderBy(desc(ipoBids.createdAt))).filter((b) => !hidden.has(b.officeId)) : [];
  const oIds = [...new Set(bids.map((b) => b.officeId))];
  const [os, us, targets] = await Promise.all([
    oIds.length ? db.select({ id: offices.id, name: offices.name, referredBy: offices.referredBy, investorType: offices.investorType }).from(offices).where(inArray(offices.id, oIds)) : [],
    oIds.length ? db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone }).from(users).where(inArray(users.officeId, oIds)) : [],
    ids.length ? db.select().from(partnerTargets).where(inArray(partnerTargets.dealId, ids)) : [],
  ]);
  const firmIds = [...new Set([...os.map((o) => o.referredBy).filter((x): x is number => !!x), ...targets.map((t) => t.officeId)])];
  const firms = firmIds.length ? await db.select({ id: offices.id, name: offices.name, investorType: offices.investorType }).from(offices).where(inArray(offices.id, firmIds)) : [];
  const office = new Map(os.map((o) => [o.id, o])), user = new Map(us.map((u) => [u.id, u])), firm = new Map(firms.filter((f) => f.investorType === "broker").map((f) => [f.id, f.name]));
  const em = (v?: string | null) => (seeContacts ? v : mask(v));

  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>IPO book</h1>
      <p className="fine" style={{ marginBottom: 16 }}>Interest registered by offices in each company&apos;s public issue. An issue appears here, and to approved offices and partners, once &ldquo;Price band announced&rdquo; has a date on the deal. These are indications, not applications: each office applies through its own broker, and anchor allocation is the lead manager&apos;s decision.</p>
      {issues.length ? issues.map((d) => {
        const stage = ipoStage(d.ipo), mine = bids.filter((b) => b.dealId === d.id), live = mine.filter((b) => b.status !== "Withdrawn");
        const byCat = (Object.keys(IPO_CATEGORY) as IpoCategory[]).map((c) => [c, live.filter((b) => b.category === c)] as const).filter(([, xs]) => xs.length);
        const byFirm = new Map<number | null, typeof live>();
        for (const b of live) { const r = office.get(b.officeId)?.referredBy ?? null; const k = r && firm.has(r) ? r : null; byFirm.set(k, [...(byFirm.get(k) ?? []), b]); }
        const tg = targets.filter((t) => t.dealId === d.id && t.leg === "ipo");
        return (
          <section key={d.id} className="adm-card" id={`i${d.id}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{d.company} <span className={`pill ${STAGE[stage][1]}`}>{STAGE[stage][0]}</span></h2>
              <span style={{ display: "flex", gap: 8 }}><a className="btn sm" href={`/admin/deals/${d.id}#issue`}>Edit the issue</a>{live.length > 0 && <a className="btn sm" href={`/admin/ipo/export?deal=${d.id}`}>Export for the lead manager (CSV)</a>}</span>
            </div>
            <p className="fine">{[d.ipo.exchange, d.ipo.priceBand && `price band ${d.ipo.priceBand}`, d.ipo.issueCr && `issue ₹${d.ipo.issueCr} Cr`, d.ipo.opens && `opens ${fmtIso(d.ipo.opens)}`, d.ipo.closes && `closes ${fmtIso(d.ipo.closes)}`, d.ipo.listing && `lists ${fmtIso(d.ipo.listing)}`].filter(Boolean).join(" · ") || "Add the issue's dates and price band on the deal."}</p>
            <p><b>{fmtAmount(sum(live))}</b> indicated by {live.length} {live.length === 1 ? "office" : "offices"}{d.ipo.issueCr && live.length ? ` · ${(sum(live) / d.ipo.issueCr * 100).toFixed(1)}% of the issue` : ""}
              {byCat.length ? <small className="fine"> · {byCat.map(([c, xs]) => `${IPO_CATEGORY[c].label}: ${fmtAmount(sum(xs))} (${xs.length})`).join(" · ")}</small> : null}</p>
            {(byFirm.size > 1 || [...byFirm.keys()].some((k) => k !== null) || tg.length > 0) && <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Brought by</th><th>Target</th><th>Clients</th><th>Indicated</th></tr></thead><tbody>
              {[...new Set([...byFirm.keys(), ...tg.map((t) => t.officeId)])].map((k) => { const xs = byFirm.get(k) ?? [], t = tg.find((x) => x.officeId === k); return (
                <tr key={k ?? 0}><th scope="row">{k ? <a href={`/admin/partners#p${k}`}>{firm.get(k) ?? `Firm #${k}`}</a> : "Direct (no partner)"}</th>
                  <td>{t ? [t.intros ? `${t.intros} clients` : "", t.amountCr ? fmtAmount(t.amountCr) : ""].filter(Boolean).join(" · ") : "—"}</td><td>{xs.length}</td><td>{xs.length ? fmtAmount(sum(xs)) : "—"}</td></tr>); })}
            </tbody></table></div>}
            {mine.length ? <div className="cmpwrap" style={{ marginTop: 10 }}><table className="cmp plain"><thead><tr><th>Office · person</th><th>Category</th><th>Amount</th><th>Applying through</th><th>Partner</th><th>Status</th></tr></thead><tbody>
              {mine.map((b) => { const o = office.get(b.officeId), u = user.get(b.userId); return (
                <tr key={b.id}><td><a href={`/admin/offices#o${b.officeId}`}>{o?.name}</a><br /><small className="fine">{u?.name} · {em(u?.email)} · {em(u?.phone)}</small></td>
                  <td>{IPO_CATEGORY[b.category as IpoCategory]?.label ?? b.category}</td><td>{fmtAmount(b.amountCr)}</td><td>{b.broker || "—"}</td>
                  <td>{o?.referredBy && firm.has(o.referredBy) ? firm.get(o.referredBy) : "—"}</td>
                  <td>{move ? <form action={saveIpoBid} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="back" value={`/admin/ipo#i${d.id}`} />
                    <select name="status" defaultValue={b.status}>{IPO_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
                    <input name="note" defaultValue={b.note ?? ""} placeholder="Note to the office" style={{ maxWidth: 170 }} /><button className="btn sm" type="submit">Save</button></form>
                    : <><span className="pill">{b.status}</span><br /><small className="fine">A super admin moves this.</small></>}</td></tr>); })}
            </tbody></table></div> : <p className="fine">No interest registered yet.</p>}
          </section>); })
        : <p className="fine">No issue yet. On a deal, under Road to listing, give &ldquo;Price band announced&rdquo; a date and fill in the public issue; it then appears here and on investors&apos; dashboards.</p>}
    </>
  );
}
