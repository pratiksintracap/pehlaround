import { TYPE_LABEL, DECL_LABEL, isQib, type InvestorType } from "@/lib/investor";
import { requireDesk } from "@/lib/auth";
import { can, isSuper, mask } from "@/lib/perm";
import { getSettings } from "@/lib/settings";
import { desc, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, invites, ndas, offices, users } from "@/db/schema";
import { setApproval, setOfficeStatus, saveOfficeNotes, resetPassword, toggleUser, revokeNda } from "@/lib/admin-actions";
import { completeness } from "@/lib/profile";
import { officeEngagement } from "@/lib/interest";
import { Msg } from "@/components/AdminBits";
import { addInvestor, importInvestors, saveInvestorContact } from "@/lib/desk-actions";
import { listTasks, officeScope } from "@/lib/desk";

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

export default async function Offices({ searchParams }: { searchParams: Promise<{ msg?: string; show?: string }> }) {
  const me = await requireDesk();
  const { msg, show } = await searchParams;
  const manage = can(me, "offices.manage"), seeContacts = can(me, "contacts.view", { analystContacts: (await getSettings()).analystContacts });
  const em = (v?: string | null) => (seeContacts ? v : mask(v));
  const db = await getDb();
  const [os, us, ns, ds, inv] = await Promise.all([
    db.select().from(offices).where(officeScope(me)).orderBy(desc(offices.createdAt)), // an analyst sees only the investors they added by hand
    db.select().from(users),
    db.select().from(ndas).orderBy(desc(ndas.signedAt)),
    db.select({ id: deals.id, company: deals.company }).from(deals),
    db.select().from(invites).where(isNull(invites.acceptedAt)),
  ]);
  const dealName = new Map(ds.map((d) => [d.id, d.company]));
  const eng = await officeEngagement();
  const order = (o: typeof os[number]) => o.approval === "pending" ? -1 : o.approval === "rejected" ? 9 : ({ pan_submitted: 0, registered: 1, verified: 2, rejected: 3 }[o.status] ?? 4);
  const pendingN = os.filter((o) => o.approval === "pending").length;
  const pick = (o: typeof os[number]) => !show ? true : show === "pending" ? o.approval === "pending" : show === "approved" ? o.approval === "approved" && o.origin !== "desk"
    : show === "registered" ? o.origin !== "desk" : show === "desk" ? o.origin === "desk" : o.approval === "rejected";
  const list = [...os].filter(pick).sort((a, b) => order(a) - order(b));
  const deskN = os.filter((o) => o.origin === "desk").length;
  const openTasks = await listTasks({ status: "open", me });
  const userEmails = new Map(us.filter((u) => u.officeId).map((u) => [u.email.toLowerCase(), u.officeId!]));
  const addMany = can(me, "investors.add");
  const AP: Record<string, [string, string]> = { pending: ["Awaiting approval", "mid"], approved: ["Approved", "ok"], rejected: ["Declined", "off"] };
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Family offices</h1>
      <p className="fine" style={{ marginBottom: 10 }}>New registrations wait here for the desk. An office sees company names, terms and NDAs only after you approve it, and it is told in its dashboard (and by email, once email is set up). {manage ? <>Approval can be switched off in <a href="/admin/settings">Settings</a>.</> : null}</p>
      <div className="adm-filter">{[["", `All (${os.length})`], ["pending", `Awaiting approval (${pendingN})`], ["approved", "Approved (registered)"], ["registered", `Registered (${os.length - deskN})`], ["desk", `Added by desk (${deskN})`], ["rejected", "Declined"]].map(([k, l]) =>
        <a key={k} href={k ? `/admin/offices?show=${k}` : "/admin/offices"} className={(show || "") === k ? "on" : ""}>{l}</a>)}</div>
      <p className="fine" style={{ marginBottom: 16 }}>Putting an office on hold closes every room to it. NDAs are signed with the signatory&apos;s name and a one-time code emailed to them; no PAN is asked until an office invests.</p>
      {list.map((o) => {
        const people = us.filter((u) => u.officeId === o.id), nn = ns.filter((x) => x.officeId === o.id);
        return (
          <details key={o.id} id={`o${o.id}`} className="adm-card" open={o.approval === "pending"}>
            <summary><b>{o.name}</b> <span className="pill">{TYPE_LABEL[o.investorType as InvestorType] || "Family office"}</span> {o.origin === "desk" ? <span className="pill mid" title="Added by the desk by hand or CSV; no registration link was sent">Added by desk</span> : <span className={`pill ${AP[o.approval]?.[1] || ""}`}>{AP[o.approval]?.[0] || o.approval}</span>} {o.status === "rejected" && <span className="pill off">On hold</span>}
              {o.origin === "desk" && o.contactEmail && userEmails.has(o.contactEmail) ? <span className="pill ok" title="Someone with this email has since registered on the site">Also registered</span> : null}
              {openTasks.some((t) => t.officeId === o.id) ? <span className="pill">{openTasks.filter((t) => t.officeId === o.id).length} open task{openTasks.filter((t) => t.officeId === o.id).length === 1 ? "" : "s"}</span> : null}
              <span className="fine"> · {people.length} {people.length === 1 ? "person" : "people"} · {eng.get(o.id)?.decks ?? 0} decks · {nn.length} NDAs · {eng.get(o.id)?.banks ?? 0} data banks · {o.origin === "desk" ? `added ${fmtD(o.createdAt)}${o.addedBy ? ` by ${o.addedBy}` : ""}` : `registered ${fmtD(o.createdAt)} · profile ${completeness(o).pct}%`}{o.aum ? ` · AUM ${o.aum}` : ""}</span></summary>
            {o.approval !== "approved" && (
              <div className="adm-approve">
                <form action={setApproval}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="approval" value="approved" /><input type="hidden" name="back" value={show ? `/admin/offices?show=${show}` : "/admin/offices"} />
                  <button className="btn sm primary" type="submit">Approve</button></form>
                {o.approval !== "rejected" && (
                  <form action={setApproval} className="adm-decline"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="approval" value="rejected" />
                    <input name="reason" placeholder="Note to the office (optional)" maxLength={1000} />
                    <label className="fine"><input type="checkbox" name="tell" /> tell them</label>
                    <button className="btn sm ghost" type="submit">Decline</button></form>)}
                {o.approval === "rejected" && <form action={setApproval}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="approval" value="pending" /><button className="btn sm ghost" type="submit">Move back to awaiting</button></form>}
              </div>)}
            <div className="two">
              <div>
                <dl className="terms compact">
                  <div><dt>Investor type</dt><dd>{TYPE_LABEL[o.investorType as InvestorType] || "Family office"}{o.declaration ? ` · ${DECL_LABEL[o.declaration] || o.declaration}` : ""}{isQib(o) ? " · QIB (not counted in the 200)" : ""}</dd></div>
                  <div><dt>Investing entity</dt><dd>{o.entityName || "—"}</dd></div>
                  {o.pan && manage && <div><dt>PAN (given before PAN was dropped)</dt><dd className="mono">{o.pan}</dd></div>}
                  <div><dt>Invests as · residency</dt><dd>{o.category || "—"} · {o.residency || "—"}</dd></div>
                  <div><dt>Ticket · AUM</dt><dd>{o.ticket || "—"} · {o.aum || "—"}</dd></div>
                  <div><dt>City · website</dt><dd>{o.city || "—"}{o.website ? <> · <a href={o.website.startsWith("http") ? o.website : `https://${o.website}`} target="_blank" rel="noopener">{o.website.replace(/^https?:\/\//, "")}</a></> : ""}</dd></div>
                  <div><dt>Sectors</dt><dd>{(o.sectors || []).join(", ") || "—"}</dd></div>
                  <div><dt>Structures · horizon</dt><dd>{(o.structures || []).join(", ") || "—"} · {o.horizon || "—"}{o.coLead ? " · open to co-lead" : ""}</dd></div>
                  <div><dt>Thesis</dt><dd>{o.thesis || "—"}</dd></div>
                  <div><dt>Approved</dt><dd>{o.approval === "approved" ? fmtD(o.approvedAt) : "—"}</dd></div>
                  <div><dt>Consents</dt><dd>{Object.entries(o.consents || {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "—"}</dd></div>
                </dl>
                {manage && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  <form action={setOfficeStatus}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="status" value={o.status === "rejected" ? "registered" : "rejected"} />
                    <button className="btn sm ghost" type="submit">{o.status === "rejected" ? "Release the hold" : "Put on hold (closes every room)"}</button></form>
                </div>}
                {o.approval === "approved" && <form action={setApproval} style={{ marginTop: 6 }}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="approval" value="pending" /><button className="btn sm ghost" type="submit">Withdraw approval</button></form>}
                <form action={saveOfficeNotes} className="form" style={{ marginTop: 10 }}><input type="hidden" name="id" value={o.id} />
                  <label>Desk notes<textarea name="notes" rows={2} defaultValue={o.notes || ""} /></label><div><button className="btn sm" type="submit">Save notes</button></div></form>
              </div>
              <div>
                {o.origin === "desk" && <>
                  <span className="k eyebrow">Contact (added by the desk)</span>
                  <p className="fine" style={{ margin: "2px 0 6px" }}>{o.contactName || "—"} · {em(o.contactEmail) || "—"} · {em(o.contactPhone) || "—"}</p>
                  <details className="dt-edit"><summary>Edit contact</summary>
                    <form action={saveInvestorContact} className="form"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value={`/admin/offices?show=desk#o${o.id}`} />
                      <div className="row"><label>Name<input name="contactName" defaultValue={o.contactName ?? ""} maxLength={160} /></label><label>Phone<input name="contactPhone" defaultValue={seeContacts ? o.contactPhone ?? "" : ""} maxLength={40} /></label></div>
                      <label>Email<input name="contactEmail" type="email" defaultValue={seeContacts ? o.contactEmail ?? "" : ""} maxLength={200} /></label>
                      <div><button className="btn sm" type="submit">Save contact</button></div></form></details>
                </>}
                <span className="k eyebrow" style={{ display: "block", marginTop: 8 }}>Tasks</span>
                <p className="fine" style={{ margin: "2px 0 8px" }}><a href={`/admin/tasks?who=all&office=${o.id}`}>Tasks for {o.name}</a> · <a href={`/admin/tasks?who=all&office=${o.id}#add`}>add one</a> · <a href={`/admin/log?office=${o.id}`}>activity</a></p>
                <span className="k eyebrow">People</span>
                <ul className="feed">{people.map((u) => (
                  <li key={u.id}><b>{u.name}</b> · {em(u.email)} · {em(u.phone) || "—"} · {u.officeRole || "—"} · {u.rights}{u.disabled ? " · disabled" : ""}<br />
                    <small className="fine">last sign-in {fmtD(u.lastLoginAt)}</small>
                    {manage && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                      <form action={resetPassword} style={{ display: "flex", gap: 6 }}><input type="hidden" name="id" value={u.id} /><input name="password" placeholder="New password" minLength={8} required style={{ maxWidth: 160 }} /><button className="btn sm" type="submit">Reset</button></form>
                      <form action={toggleUser}><input type="hidden" name="id" value={u.id} /><button className="btn sm ghost" type="submit">{u.disabled ? "Enable" : "Disable"}</button></form>
                    </div>}</li>))}
                  {inv.filter((i) => i.officeId === o.id).map((i) => <li key={`i${i.id}`}>{em(i.email)} · invited · {i.rights}</li>)}
                </ul>
                <span className="k eyebrow">NDAs</span>
                <ul className="feed">{nn.length ? nn.map((x) => (
                  <li key={x.id}>{dealName.get(x.dealId)} · {x.signerName} · {fmtD(x.signedAt)} · v{x.version}{x.revokedAt ? " · revoked" : ""} · <a href={`/dashboard/nda/${x.id}`}>copy</a>
                    {!x.revokedAt && manage && <form action={revokeNda} style={{ display: "inline" }}><input type="hidden" name="id" value={x.id} /> <button className="btn sm ghost" type="submit">Revoke</button></form>}</li>))
                  : <li className="empty-li">None yet.</li>}</ul>
              </div>
            </div>
          </details>
        );
      })}
      {!list.length && <p>{os.length ? "No offices in this view." : "No family offices have registered yet."}</p>}
      {addMany && <div className="chart" style={{ marginTop: 24 }} id="add"><span className="k">Add investors you are in touch with</span>
        <p className="fine" style={{ margin: "4px 0 10px" }}>They are added already approved and tagged <b>Added by desk</b>, so you can filter them from offices that registered. {isSuper(me) ? "You see every investor the desk added; each analyst sees only the ones they added." : "Only you (and the super admin) see the investors you add."} No registration link or email goes to them, and nobody can sign in as them; if they register later, the office list marks the match as &ldquo;Also registered&rdquo;.</p>
        <div className="two">
          <form action={addInvestor} className="form"><input type="hidden" name="back" value="/admin/offices?show=desk" />
            <b>One investor</b>
            <div className="row"><label>Name (office, fund or person)<input name="name" required maxLength={200} /></label>
              <label>Type<select name="type" defaultValue="Family office"><option>Family office</option><option>Fund</option><option>Individual</option></select></label></div>
            <div className="row"><label>Contact person<input name="contactName" maxLength={160} /></label><label>Phone<input name="phone" maxLength={40} /></label></div>
            <div className="row"><label>Email<input name="email" type="email" maxLength={200} /></label><label>City<input name="city" maxLength={120} /></label></div>
            <div className="row"><label>Ticket<input name="ticket" maxLength={80} placeholder="₹2–5 crore" /></label><label>Website<input name="website" maxLength={300} /></label></div>
            <label>Notes<textarea name="notes" rows={2} maxLength={4000} /></label>
            <div><button className="btn sm primary" type="submit">Add investor</button></div></form>
          <form action={importInvestors} className="form"><input type="hidden" name="back" value="/admin/offices?show=desk" />
            <b>Many, from a CSV</b>
            <p className="fine" style={{ margin: 0 }}>First row names the columns. Needed: <span className="mono">Name</span>. Optional: <span className="mono">Type, Contact, Email, Phone, City, Ticket, Website, Notes</span>. Rows whose email or name is already on the desk are skipped.</p>
            <label>CSV file<input type="file" name="file" accept=".csv,text/csv" /></label>
            <label>Or paste the rows<textarea name="csv" rows={5} placeholder={"Name,Type,Contact,Email,Phone,City\nMehta Family Office,Family office,Raj Mehta,raj@example.com,+91 98…,Mumbai"} /></label>
            <div><button className="btn sm primary" type="submit">Import</button></div></form>
        </div></div>}
    </>
  );
}
