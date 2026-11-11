import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { can, isSuper } from "@/lib/perm";
import { getDb } from "@/lib/db";
import { deals, deskInvites, interests, leads, ndas, offices, partnerTargets, users } from "@/db/schema";
import { invitePartner, savePartnerTarget } from "@/lib/partner-actions";
import { fmtCr, progress, tally, type Client } from "@/lib/partner-math";
import { SITE_URL } from "@/lib/site";

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

/** Partners: firms (offices of type "broker") that bring their clients to the desk's issues. Applications, the firms,
 *  each firm's relationship managers, and the target the desk sets for a firm on an issue. */
export default async function Partners() {
  const me = await requireDesk();
  const invite = isSuper(me), setTargets = can(me, "workflow");
  const db = await getDb();
  const [firms, apps, ds, waiting] = await Promise.all([
    db.select().from(offices).where(eq(offices.investorType, "broker")).orderBy(desc(offices.createdAt)),
    db.select().from(leads).where(eq(leads.kind, "partner")).orderBy(desc(leads.createdAt)),
    db.select({ id: deals.id, company: deals.company, phase: deals.phase, ipo: deals.ipo }).from(deals).where(eq(deals.listed, false)).orderBy(deals.sort),
    db.select().from(deskInvites).where(and(eq(deskInvites.investorType, "broker"), isNull(deskInvites.usedAt))).orderBy(desc(deskInvites.createdAt)),
  ]);
  const fIds = firms.map((f) => f.id);
  const [people, clients, targets] = fIds.length ? await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, rights: users.rights, officeId: users.officeId, disabled: users.disabled }).from(users).where(inArray(users.officeId, fIds)),
    db.select({ id: offices.id, name: offices.name, approval: offices.approval, createdAt: offices.createdAt, rmId: offices.referredByUserId, firm: offices.referredBy }).from(offices).where(inArray(offices.referredBy, fIds)),
    db.select().from(partnerTargets).where(inArray(partnerTargets.officeId, fIds)),
  ]) : [[], [], []];
  const cIds = clients.map((c) => c.id);
  const [cNdas, cAsks] = cIds.length ? await Promise.all([
    db.select({ officeId: ndas.officeId, dealId: ndas.dealId, signedAt: ndas.signedAt }).from(ndas).where(and(inArray(ndas.officeId, cIds), isNull(ndas.revokedAt))),
    db.select({ officeId: interests.officeId, dealId: interests.dealId, amountCr: interests.amountCr, status: interests.status }).from(interests).where(inArray(interests.officeId, cIds)),
  ]) : [[], []];
  const dealName = new Map(ds.map((d) => [d.id, d.company]));
  const live = ds.filter((d) => d.phase !== "preparing");
  const openApps = apps.filter((a) => a.status === "New");

  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Partners</h1>
      <p className="fine" style={{ marginBottom: 16 }}>Wealth managers, brokers and advisers who bring their clients to the desk&apos;s issues. A partner firm is an office of type Broker / wealth manager: its principal sees every client the firm introduced, each relationship manager only their own. Fees and commissions are in the partner agreement, never on the site.</p>

      <h2 id="apply">Applications{openApps.length ? ` (${openApps.length} new)` : ""}</h2>
      {apps.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>When</th><th>Who</th><th>Details</th><th>Status</th><th /></tr></thead><tbody>
        {apps.map((l) => (
          <tr key={l.id}><td>{fmtD(l.createdAt)}</td><td>{l.name} · {l.company}<br /><small className="fine">{l.email} · {l.phone}</small></td>
            <td><small>{Object.entries(l.data || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ")}</small></td>
            <td><span className={`pill ${l.status === "New" ? "mid" : ""}`}>{l.status}</span></td>
            <td>{invite && l.email ? <form action={invitePartner}><input type="hidden" name="leadId" value={l.id} /><input type="hidden" name="email" value={l.email} /><input type="hidden" name="name" value={l.name ?? ""} /><input type="hidden" name="firm" value={l.company ?? l.name ?? ""} />
              <button className="btn sm" type="submit">Invite as partner</button></form> : null}</td></tr>))}
      </tbody></table></div> : <p className="fine">No applications yet. They come from the public Partner page.</p>}
      {invite && <details className="adm-card" style={{ marginTop: 12 }}><summary><b>Invite a firm by hand</b></summary>
        <form action={invitePartner} className="form"><div className="row3"><label>Firm<input name="firm" required maxLength={160} /></label><label>Contact name<input name="name" maxLength={120} /></label><label>Email<input name="email" type="email" required maxLength={200} /></label></div>
          <div><button className="btn sm" type="submit">Make the partner link</button></div>
          <p className="fine">The link registers the firm already approved, as a partner. No email goes out: send the link yourself, with the partner agreement. A firm already on the desk becomes a partner under Family offices (investor type).</p></form></details>}
      {waiting.length > 0 && <div id="invited" className="adm-card"><b>Invited, not yet registered</b>
        <ul className="feed">{waiting.map((w) => { const url = `${SITE_URL}/invite/${w.token}`; return (
          <li key={w.id}>{w.officeName || w.name} · <small className="fine">{w.email} · {fmtD(w.createdAt)}</small>
            <div className="dl-acts"><input readOnly value={url} aria-label={`Partner link for ${w.officeName}`} /><button type="button" className="btn sm" data-copy={url}>Copy</button></div></li>); })}</ul></div>}

      <h2 id="firms" style={{ marginTop: 28 }}>Partner firms ({firms.length})</h2>
      {firms.length ? firms.map((f) => {
        const fc: Client[] = clients.filter((c) => c.firm === f.id), fp = people.filter((p) => p.officeId === f.id && !p.disabled), ft = targets.filter((t) => t.officeId === f.id);
        const all = tally(fc, cNdas, cAsks);
        return (
          <details key={f.id} id={`p${f.id}`} className="adm-card">
            <summary><b>{f.name}</b> <span className={`pill ${f.approval === "approved" ? "ok" : "mid"}`}>{f.approval === "approved" ? "Approved" : f.approval === "rejected" ? "Declined" : "Awaiting approval"}</span>
              <span className="fine"> · {fp.length} {fp.length === 1 ? "person" : "people"} · {all.clients} clients · {all.intros} introductions · {fmtCr(all.indicatedCr)} requested · {fmtCr(all.allottedCr)} allotted</span></summary>
            <p className="fine"><a href={`/admin/offices#o${f.id}`}>Open the office record</a>{f.city ? ` · ${f.city}` : ""} · joined {fmtD(f.createdAt)}</p>

            <h3 style={{ fontSize: 15, margin: "12px 0 6px" }}>Targets by issue</h3>
            {ft.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Issue</th><th>Leg</th><th>Target</th><th>So far</th><th>Set by</th></tr></thead><tbody>
              {ft.map((t) => { const c = tally(fc, cNdas, cAsks, t.dealId); const p = t.leg === "pre_ipo" ? progress(t, c) : null; return (
                <tr key={t.id}><th scope="row">{dealName.get(t.dealId) ?? `#${t.dealId}`}</th><td>{t.leg === "ipo" ? "IPO" : "Pre-IPO round"}</td>
                  <td>{[t.intros ? `${t.intros} ${t.leg === "ipo" ? "clients" : "introductions"}` : "", t.amountCr ? fmtCr(t.amountCr) : ""].filter(Boolean).join(" · ")}{t.note ? <><br /><small className="fine">{t.note}</small></> : null}</td>
                  <td>{t.leg === "pre_ipo" ? <>{c.intros} introductions · {fmtCr(c.indicatedCr)}{p !== null ? ` · ${Math.round(p * 100)}%` : ""}</> : <a href="/admin/ipo">See the IPO book</a>}</td>
                  <td><small className="fine">{t.setBy} · {fmtD(t.updatedAt)}</small></td></tr>); })}
            </tbody></table></div> : <p className="fine">No targets set.</p>}
            {setTargets && <form action={savePartnerTarget} className="form" style={{ marginTop: 8 }}><input type="hidden" name="officeId" value={f.id} />
              <div className="row3"><label>Issue<select name="dealId" required defaultValue="">{[<option key="" value="" disabled>Select</option>, ...live.map((d) => <option key={d.id} value={d.id}>{d.company}</option>)]}</select></label>
                <label>Leg<select name="leg" defaultValue="pre_ipo"><option value="pre_ipo">Pre-IPO round</option><option value="ipo">IPO</option></select></label>
                <label>Introductions (clients)<input name="intros" inputMode="numeric" placeholder="e.g. 5" /></label></div>
              <div className="row"><label>Amount, ₹ Cr<input name="amountCr" inputMode="decimal" placeholder="e.g. 2.5" /></label><label>Note to the firm (optional)<input name="note" maxLength={300} placeholder="e.g. by 30 November" /></label></div>
              <label className="chk"><input type="checkbox" name="tell" defaultChecked /> Tell the firm</label>
              <div><button className="btn sm" type="submit">Save target</button></div>
              <p className="fine">Saving again for the same issue and leg replaces the target; leave both numbers empty to clear it.</p></form>}

            <h3 style={{ fontSize: 15, margin: "16px 0 6px" }}>Relationship managers</h3>
            <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Person</th><th>Clients</th><th>Approved</th><th>Introductions</th><th>Requested</th><th>Allotted</th></tr></thead><tbody>
              {fp.map((p) => { const c = tally(fc.filter((x) => x.rmId === p.id), cNdas, cAsks); return (
                <tr key={p.id}><th scope="row">{p.name}{/commit/i.test(p.rights) ? <small className="fine"> · principal</small> : null}</th><td>{c.clients}</td><td>{c.approved}</td><td>{c.intros}</td><td>{fmtCr(c.indicatedCr)}</td><td>{fmtCr(c.allottedCr)}</td></tr>); })}
              {(() => { const ids = new Set(fp.map((p) => p.id)); const c = tally(fc.filter((x) => !x.rmId || !ids.has(x.rmId)), cNdas, cAsks); return c.clients ? <tr><th scope="row">The firm&apos;s link</th><td>{c.clients}</td><td>{c.approved}</td><td>{c.intros}</td><td>{fmtCr(c.indicatedCr)}</td><td>{fmtCr(c.allottedCr)}</td></tr> : null; })()}
            </tbody></table></div>

            <h3 style={{ fontSize: 15, margin: "16px 0 6px" }}>Clients</h3>
            {fc.length ? <ul className="feed">{fc.map((c) => { const n = cNdas.filter((x) => x.officeId === c.id), a = cAsks.filter((x) => x.officeId === c.id && x.status !== "Withdrawn"); return (
              <li key={c.id}><a href={`/admin/offices#o${c.id}`}>{c.name}</a> · {c.approval} · joined {fmtD(c.createdAt)}{n.length ? ` · NDAs: ${n.map((x) => dealName.get(x.dealId)).join(", ")}` : ""}{a.length ? ` · asked: ${a.map((x) => `${dealName.get(x.dealId)} ₹${Number(x.amountCr)} Cr (${x.status})`).join(", ")}` : ""}</li>); })}</ul>
              : <p className="fine">No clients yet.</p>}
          </details>); })
        : <p className="fine">No partner firms yet. Invite one above, or set an existing office&apos;s investor type to Broker / wealth manager under Family offices.</p>}
    </>
  );
}
