import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireUser, maskPan, REQUIRE_VERIFIED } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { audit, calls, docViews, documents, interests, invites, ndas, passes, questions, users } from "@/db/schema";
import { listDeals } from "@/lib/deals";
import { monthsTo } from "@/lib/render";
import { GRIEVANCE } from "@/lib/site";

export const metadata: Metadata = { title: "Your office", robots: { index: false } };
type P = { searchParams: Promise<{ msg?: string; error?: string }> };

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const STATUS: Record<string, string> = { registered: "Registered", pan_submitted: "PAN submitted · being checked", verified: "PAN verified", rejected: "On hold" };

export default async function Dashboard({ searchParams }: P) {
  const user = await requireUser("/dashboard");
  if (user.role === "admin" && !user.officeId) redirect("/admin");
  const { msg, error } = await searchParams;
  const office = user.office!;
  const db = await getDb();
  const deals = await listDeals();
  const byId = new Map(deals.map((d) => [d.id, d]));
  const [myNdas, myInterests, myPasses, myCalls, myQs, team, pending, log, views] = await Promise.all([
    db.select().from(ndas).where(and(eq(ndas.officeId, office.id), isNull(ndas.revokedAt))).orderBy(desc(ndas.signedAt)),
    db.select().from(interests).where(eq(interests.officeId, office.id)).orderBy(desc(interests.createdAt)),
    db.select().from(passes).where(eq(passes.officeId, office.id)).orderBy(desc(passes.createdAt)),
    db.select().from(calls).where(eq(calls.officeId, office.id)).orderBy(desc(calls.createdAt)),
    db.select().from(questions).where(eq(questions.officeId, office.id)).orderBy(desc(questions.askedAt)),
    db.select().from(users).where(eq(users.officeId, office.id)),
    db.select().from(invites).where(and(eq(invites.officeId, office.id), isNull(invites.acceptedAt))),
    db.select().from(audit).where(eq(audit.officeId, office.id)).orderBy(desc(audit.at)).limit(200),
    db.select({ at: docViews.at, title: documents.title, dealId: documents.dealId, userId: docViews.userId }).from(docViews)
      .innerJoin(documents, eq(documents.id, docViews.documentId)).where(eq(docViews.officeId, office.id)).orderBy(desc(docViews.at)).limit(100),
  ]);
  const signed = new Set(myNdas.map((n) => n.dealId));
  const sessions = signed.size ? await db.select().from(calls).where(and(eq(calls.kind, "session"), inArray(calls.dealId, [...signed]))).orderBy(desc(calls.createdAt)) : [];
  const userName = new Map(team.map((u) => [u.id, u.name]));
  const allotted = myInterests.filter((i) => i.status === "Allotted");
  const indicated = myInterests.filter((i) => i.status !== "Withdrawn");
  const totalInd = indicated.reduce((s, i) => s + Number(i.amountCr), 0);
  const firstOpen = deals.find((d) => signed.has(d.id)) || deals.find((d) => d.open);
  const rail = [
    ["Registered", "done"], ["PAN on record", office.pan ? "done" : "now"],
    ["NDA per deal", signed.size ? "done" : office.pan ? "now" : ""], ["Rooms unlocked", signed.size ? "done" : ""],
  ];
  const canCommit = /commit/i.test(user.rights);

  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}><div className="room" id="dash">
      <div className="roomhead">
        <div>
          <span className="eyebrow">Office dashboard</span>
          <h1>{office.name}</h1>
          <p className="lede">Everything your office does on the desk, in one place: the shelf, the rooms you opened, calls, documents, what you hold, your team, and a log of who saw what.</p>
          <ol className="statusrail" aria-label="Your status">{rail.map(([t, c]) => <li key={t} className={c}>{t}</li>)}</ol>
          {msg && <p className="notice" style={{ marginTop: 12 }}>{msg}</p>}
          {error && <p className="notice" style={{ marginTop: 12, borderColor: "var(--warn, #c0392b)" }}>{error}</p>}
        </div>
        <div className="roomside">
          <div className="kv"><span>Rooms open to you</span><b>{signed.size}</b></div>
          <div className="kv"><span>Questions asked</span><b>{myQs.length}</b></div>
          <div className="kv"><span>Passed</span><b>{myPasses.length}</b></div>
          <div className="kv"><span>Allocations requested</span><b>{indicated.length ? `${indicated.length} · ₹${+totalInd.toFixed(2)} Cr` : "0"}</b></div>
          {firstOpen && <a className="btn primary" href={signed.has(firstOpen.id) ? `/room/${firstOpen.slug}` : `/nda/${firstOpen.slug}`}>{signed.has(firstOpen.id) ? "Open your latest room" : "Open your first room"}</a>}
        </div>
      </div>

      <div className="tabs" role="tablist">
        {[["Shelf", "Shelf"], ["Rooms", "My rooms"], ["Calls", "Calls"], ["Documents", "Documents"], ["Portfolio", "Portfolio"], ["Team", "Team and profile"], ["Log", "Activity log"]].map(([k, t], i) =>
          <button key={k} role="tab" type="button" className="tabbtn" data-tab={k} aria-selected={i === 0}>{t}</button>)}
      </div>

      <section className="panel" data-panel="Shelf">
        <div className="cmpwrap"><table className="cmp plain" id="shelf-t"><thead><tr><th>Deal</th><th>Structure</th><th>Target listing</th><th>Round</th><th>Pre-money</th><th>P/E trailing · forward</th><th>Min ticket</th><th /></tr></thead>
          <tbody>{deals.map((d) => (
            <tr key={d.id} data-struct={d.category} data-months={monthsTo(d.listingMonth) ?? 999}>
              <th scope="row">{d.company}<br /><small className="fine">{d.title}</small><br />
                <span className={`pill ${signed.has(d.id) ? "ok" : ""}`}>{signed.has(d.id) ? "NDA signed" : d.open ? "Room open" : "Not open"}</span></th>
              <td>{d.category}</td><td>{d.listingLabel}{d.listingNote ? ` · ${d.listingNote}` : ""}</td><td>{d.roundLabel || "—"}</td><td>{d.preMoney || "—"}</td><td>{d.peLabel || "—"}</td><td>{d.minTicket || "—"}</td>
              <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {signed.has(d.id) ? <a className="btn sm primary" href={`/room/${d.slug}`}>Open room</a> : d.open ? <a className="btn sm primary" href={`/nda/${d.slug}`}>Sign NDA</a> : null}
                <a className="btn sm" href={`/deals/${d.slug}`}>Overview</a></div></td>
            </tr>
          ))}</tbody></table></div>
        <p className="fine">Same fields for every deal so offices can compare quickly. Each room opens with that company&apos;s own NDA.</p>
      </section>

      <section className="panel" data-panel="Rooms" hidden>
        <div className="two">
          <div className="chart"><span className="k">NDAs signed · rooms open</span><ul className="feed">
            {myNdas.length ? myNdas.map((n) => <li key={n.id}><b><a href={`/room/${byId.get(n.dealId)?.slug}`}>{byId.get(n.dealId)?.company}</a></b> · {fmtD(n.signedAt)}</li>)
              : <li className="empty-li">No rooms yet. Sign a company&apos;s NDA from the Shelf.</li>}</ul></div>
          <div className="chart"><span className="k">Allocations requested</span><ul className="feed">
            {indicated.length ? indicated.map((i) => <li key={i.id}><b>{byId.get(i.dealId)?.company}</b> · ₹{Number(i.amountCr)} Cr{i.colead ? " · co-lead interest" : ""} · {i.status} · {fmtD(i.createdAt)}</li>)
              : <li className="empty-li">None yet.</li>}</ul></div>
          <div className="chart"><span className="k">Passed, with your reason</span><ul className="feed">
            {myPasses.length ? myPasses.map((p) => <li key={p.id}><b>{byId.get(p.dealId)?.company}</b> · “{p.reason}{p.note ? ` · ${p.note}` : ""}” · {fmtD(p.createdAt)}</li>)
              : <li className="empty-li">Nothing passed.</li>}</ul></div>
          <div className="chart"><span className="k">Your questions</span><ul className="feed">
            {myQs.length ? myQs.map((q) => <li key={q.id}><b>{byId.get(q.dealId)?.company}</b> · {q.question} · {q.answer ? <span className="pill ok">Answered</span> : <span className="pill">Awaiting</span>}</li>)
              : <li className="empty-li">No questions yet. Ask from any room&apos;s Q&amp;A.</li>}</ul></div>
        </div>
      </section>

      <section className="panel" data-panel="Calls" hidden>
        <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Deal</th><th>Call</th><th>Status</th><th>When</th><th>Summary</th></tr></thead><tbody>
          {[...sessions, ...myCalls].length ? [...sessions, ...myCalls].map((c) => (
            <tr key={c.id}><th scope="row">{byId.get(c.dealId)?.company}</th>
              <td>{c.kind === "session" ? (c.title || "Group session") : `Management call requested · ${c.slot}`}</td>
              <td><span className={`pill ${c.status === "Held" ? "ok" : ""}`}>{c.status}</span></td>
              <td>{c.scheduledFor || fmtD(c.createdAt)}</td><td>{c.summary || (c.status === "Held" ? "Posted to the room" : "Posted after the call")}</td></tr>
          )) : <tr><td colSpan={5} className="fine">No calls yet. Request one from a room&apos;s Q&amp;A panel.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel" data-panel="Documents" hidden>
        <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Document</th><th>Deal</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>
          {myNdas.map((n) => (
            <tr key={`n${n.id}`}><th scope="row">NDA with {byId.get(n.dealId)?.company}</th><td>{byId.get(n.dealId)?.title}</td>
              <td><span className="pill ok">Signed · version {n.version}</span></td><td>{fmtD(n.signedAt)}</td><td><a className="btn sm" href={`/dashboard/nda/${n.id}`}>View</a></td></tr>
          ))}
          <tr><th scope="row">PAN of the investing entity</th><td>Office</td><td><span className={`pill ${office.status === "verified" ? "ok" : ""}`}>{office.pan ? (office.status === "verified" ? "Verified" : "Submitted") : "Not yet"}</span></td><td>{office.verifiedAt ? fmtD(office.verifiedAt) : "—"}</td><td /></tr>
          <tr><th scope="row">KYC pack: address, bank, demat, authorised signatory</th><td>Office</td><td><span className="pill">At commitment</span></td><td>—</td><td /></tr>
        </tbody></table></div>
        {views.length > 0 && <>
          <h3 style={{ marginTop: 18 }}>Documents your office opened</h3>
          <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>When</th><th>Who</th><th>Document</th><th>Deal</th></tr></thead><tbody>
            {views.map((v, i) => <tr key={i}><td>{fmtT(v.at)}</td><td>{userName.get(v.userId) || "—"}</td><td>{v.title}</td><td>{byId.get(v.dealId)?.company}</td></tr>)}
          </tbody></table></div>
        </>}
        <p className="fine">Every document view is written to the activity log.</p>
      </section>

      <section className="panel" data-panel="Portfolio" hidden>
        {allotted.length ? <div className="two">{allotted.map((a) => { const d = byId.get(a.dealId); return (
          <div className="chart" key={a.id}><span className="k">Holding</span><h3 style={{ margin: "4px 0" }}>{d?.company}</h3>
            <div className="kv"><span>Allocation</span><b>₹{Number(a.amountCr)} Cr</b></div>
            <div className="kv"><span>Structure</span><b>{d?.category}</b></div>
            <div className="kv"><span>Target listing</span><b>{d?.listingLabel}{d?.listingNote ? `, ${d.listingNote}` : ""}</b></div>
            <div className="kv"><span>Lock-in</span><b>Six months from listing</b></div></div>); })}</div>
          : <div className="chart"><span className="k">Holdings</span><p>Nothing allotted yet. Once shares are credited to your demat, each holding appears here with its listing milestones, lock-in dates and the company&apos;s quarterly updates.</p></div>}
      </section>

      <section className="panel" data-panel="Team" hidden>
        <div className="two">
          <div className="chart"><span className="k">Investing entity</span>
            <div className="kv"><span>Office</span><b>{office.name}</b></div>
            <div className="kv"><span>Entity</span><b>{office.entityName || "Added with your first NDA"}</b></div>
            <div className="kv"><span>PAN</span><b>{maskPan(office.pan)}{office.pan ? ` · ${STATUS[office.status] || office.status}` : ""}</b></div>
            <div className="kv"><span>Invests as</span><b>{office.category || "—"}</b></div>
            <div className="kv"><span>Residency</span><b>{office.residency || "—"}</b></div>
            <div className="kv"><span>Ticket band</span><b>{office.ticket || "—"}</b></div>
            {REQUIRE_VERIFIED && office.status !== "verified" && <p className="fine">Rooms open once the desk has checked the PAN.</p>}
          </div>
          <div className="chart"><span className="k">People with access</span>
            <div className="cmpwrap"><table className="cmp plain" style={{ minWidth: 0 }}><thead><tr><th>Name</th><th>Role</th><th>Rights</th></tr></thead><tbody>
              {team.map((t) => <tr key={t.id}><th scope="row">{t.name}<br /><small className="fine">{t.email}</small></th><td>{t.officeRole || "—"}</td><td>{t.rights}</td></tr>)}
              {pending.map((p) => <tr key={`i${p.id}`}><th scope="row">{p.email}</th><td>Invited</td><td>{p.rights}</td></tr>)}
            </tbody></table></div>
            {canCommit && <form className="form" method="post" action="/api/office/invite" style={{ marginTop: 10 }}>
              <div className="row"><label>Email<input type="email" name="email" required placeholder="name@office.in" /></label>
                <label>Rights<select name="rights" defaultValue="View"><option>View</option><option>View, comment</option><option>View, comment, commit</option></select></label></div>
              <div><button className="btn" type="submit">Add viewer</button></div>
              <p className="fine">They join your office when they register with this email. Each deal&apos;s NDA covers your office&apos;s team for that deal.</p>
            </form>}
          </div>
        </div>
        <div className="chart"><span className="k">Consents and your data</span>
          <form method="post" action="/api/office/consents" style={{ display: "grid", gap: 8 }}>
            <label className="chk"><input type="checkbox" name="email" defaultChecked={office.consents?.email !== false} /> Deal alerts by email</label>
            <label className="chk"><input type="checkbox" name="wa" defaultChecked={!!office.consents?.wa} /> WhatsApp messages about deals</label>
            <label className="chk"><input type="checkbox" name="calls" defaultChecked={!!office.consents?.calls} /> Calls from the desk</label>
            <div><button className="btn sm" type="submit">Save consents</button></div>
          </form>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <a className="btn sm" href="/api/office/export">Download my data</a>
            <form method="post" action="/api/office/deletion"><button className="btn sm ghost" type="submit">Request deletion</button></form>
          </div>
          <p className="fine">Grievance officer and data-protection contact: {GRIEVANCE.name}, <a href={`mailto:${GRIEVANCE.email}`}>{GRIEVANCE.email}</a>.</p>
        </div>
      </section>

      <section className="panel" data-panel="Log" hidden>
        <div className="cmpwrap"><table className="cmp"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>
          {log.map((l) => <tr key={l.id}><td>{fmtT(l.at)}</td><td>{l.who || "—"}</td><td>{l.action}</td></tr>)}
        </tbody></table></div>
        <p className="fine">The log shows the desk offered each deal only to identified people, which is what the private placement rules require.</p>
      </section>
    </div></div></main>
  );
}
