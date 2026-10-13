import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireUser, maskPan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { audit, calls, docViews, documents, interests, invites, ndas, passes, questions, users } from "@/db/schema";
import { listDeals, canSeeNames } from "@/lib/deals";
import { monthsTo } from "@/lib/render";
import { AppPromo } from "@/components/AppPromo";
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
  const [allDeals, names, st] = await Promise.all([listDeals(), canSeeNames(user), getSettings()]);
  const deals = names ? allDeals : allDeals.map((d) => ({ ...d, company: d.title, roundLabel: "After approval", preMoney: "After approval", peLabel: "After approval" }));
  const pendingApproval = !names;
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
  // the room this office was in last (from its own log), else the NDA it signed most recently
  const lastOpened = log.find((l) => l.dealId && signed.has(l.dealId) && l.action.startsWith("Opened the room")) ?? log.find((l) => l.dealId && signed.has(l.dealId));
  const latest = byId.get(lastOpened?.dealId ?? myNdas[0]?.dealId ?? -1);
  const topPick = [...deals].filter((d) => d.open && !signed.has(d.id)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const panWait = st.requirePan && signed.size > 0 && office.status !== "verified";
  // progress: four steps, shown until the office has a room open
  const steps: [string, string, "done" | "now" | "todo"][] = [
    ["Registered", "Your office is on the desk", "done"],
    ["Approved", names ? "Every company is open to you by name" : "The desk reviews new offices, usually within a working day", names ? "done" : "now"],
    ["First NDA signed", signed.size ? "Your PAN and investing entity are on record" : "Sign one company's NDA; PAN and entity are asked once, with it", signed.size ? "done" : names ? "now" : "todo"],
    ["Rooms open", panWait ? "The desk is checking your PAN" : signed.size ? `${signed.size} ${signed.size === 1 ? "room" : "rooms"} open to you` : "Numbers, documents and Q&A for each company", signed.size && !panWait ? "done" : signed.size ? "now" : "todo"],
  ];
  const showSteps = !signed.size || panWait;
  const profileGaps = [!office.category && "category", !office.residency && "residency", !office.ticket && "ticket"].filter(Boolean) as string[];
  const welcome = names && !signed.size; // approved but no room yet: the welcome pop-up guides the first step
  const canCommit = /commit/i.test(user.rights);

  return (
    <main><div className="wrap" style={{ paddingTop: 20, paddingBottom: 56 }}><div className="room" id="dash">
      <div className="dashhead">
        <div className="dh-name"><span className="eyebrow">Office dashboard</span><h1>{office.name}</h1></div>
        <div className="dh-stats">
          <a href="#Rooms"><b>{signed.size}</b><span>{signed.size === 1 ? "room open" : "rooms open"}</span></a>
          <a href="#Rooms"><b>{myQs.length}</b><span>questions</span></a>
          <a href="#Rooms"><b>{indicated.length ? `₹${+totalInd.toFixed(2)} Cr` : "0"}</b><span>{indicated.length ? `requested · ${indicated.length}` : "allocations requested"}</span></a>
          {latest && <a className="btn primary sm dh-go" href={`/room/${latest.slug}`}>Continue in {latest.company} →</a>}
        </div>
      </div>
      {msg && <p className="notice" style={{ marginTop: 12 }}>{msg}</p>}
      {error && <p className="notice" style={{ marginTop: 12, borderColor: "var(--warn, #c0392b)" }}>{error}</p>}

      {showSteps && (
        <section className="nextstep" aria-label="Your progress">
          <ol className="osteps">{steps.map(([t, sub, c], i) => (
            <li key={t} className={c} aria-current={c === "now" ? "step" : undefined}><span className="dot" aria-hidden="true">{c === "done" ? "✓" : i + 1}</span><div><b>{t}</b><small>{sub}</small></div></li>))}</ol>
          <div className="ns-act">
            {pendingApproval ? <p className="fine">You can browse the shelf below in the meantime. We will tell you under the bell and by email the moment your office is approved.</p>
              : !signed.size && topPick ? <><a className="btn primary" href={`/nda/${topPick.slug}`}>Open your first room: {topPick.company}</a><a className="btn ghost" href="#Shelf">Or choose from the shelf ↓</a></>
              : panWait ? <p className="fine">Your room opens as soon as the desk has checked the PAN, usually the same working day.</p> : null}
          </div>
        </section>
      )}

      <div className="tabs" role="tablist">
        {[["Shelf", "Shelf"], ["Rooms", "My rooms"], ["Calls", "Calls"], ["Documents", "Documents"], ["Portfolio", "Portfolio"], ["Team", "Team and profile"], ["Log", "Activity log"]].map(([k, t], i) =>
          <button key={k} role="tab" type="button" className="tabbtn" data-tab={k} aria-selected={i === 0}>{t}</button>)}
      </div>

      <section className="panel" data-panel="Shelf">
        <div className="cmpwrap"><table className="cmp plain" id="shelf-t"><thead><tr><th>Deal</th><th>Structure</th><th>Target listing</th><th>Round</th><th>Pre-money</th><th>P/E trailing · forward</th><th>Min ticket</th><th>Desk Score</th><th /></tr></thead>
          <tbody>{deals.map((d) => (
            <tr key={d.id} data-struct={d.category} data-months={monthsTo(d.listingMonth) ?? 999}>
              <th scope="row">{d.company}{names && <><br /><small className="fine">{d.title}</small></>}<br />
                <span className={`pill ${signed.has(d.id) ? "ok" : ""}`}>{signed.has(d.id) ? "NDA signed" : d.open ? "Room open" : "Not open"}</span></th>
              <td>{d.category}</td><td>{d.listingLabel}{d.listingNote ? ` · ${d.listingNote}` : ""}</td><td>{d.roundLabel || "—"}</td><td>{d.preMoney || "—"}</td><td>{d.peLabel || "—"}</td><td>{d.minTicket || "—"}</td><td>{d.score != null ? <b>{d.score.toFixed(1)}</b> : "—"}</td>
              <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {signed.has(d.id) ? <a className="btn sm primary" href={`/room/${d.slug}`}>Open room</a> : d.open && names ? <a className="btn sm primary" href={`/nda/${d.slug}`}>Sign NDA</a> : null}
                <a className="btn sm" href={`/deals/${d.slug}`}>Overview</a></div></td>
            </tr>
          ))}</tbody></table></div>
        <ul className="dash-cards">{deals.map((d) => (
          <li key={d.id}>
            <div className="dc-top"><b>{d.company}</b><span className={`pill ${signed.has(d.id) ? "ok" : ""}`}>{signed.has(d.id) ? "NDA signed" : d.open ? "Room open" : "Not open"}</span></div>
            <small>{names ? `${d.title} · ` : ""}{d.category}</small>
            <dl><div><dt>Round</dt><dd>{d.roundLabel || "—"}</dd></div><div><dt>Pre-money</dt><dd>{d.preMoney || "—"}</dd></div>
              <div><dt>P/E</dt><dd>{d.peLabel || "—"}</dd></div><div><dt>Listing</dt><dd>{d.listingLabel}</dd></div>{d.score != null && <div><dt>Desk Score</dt><dd>{d.score.toFixed(1)} / 10</dd></div>}</dl>
            <div className="dc-acts">
              {signed.has(d.id) ? <a className="btn sm primary" href={`/room/${d.slug}`}>Open room</a> : d.open && names ? <a className="btn sm primary" href={`/nda/${d.slug}`}>Sign NDA</a> : null}
              <a className="btn sm" href={`/deals/${d.slug}`}>Overview</a></div>
          </li>))}</ul>
        <p className="fine">Same fields for every deal so offices can compare quickly. Each room opens with that company&apos;s own NDA.</p>
        <AppPromo variant="bar" text="New deals, promoter answers and approvals on your home screen, the moment they land." />
      </section>

      <section className="panel" data-panel="Rooms" hidden>
        <div className="two">
          <div className="chart"><span className="k">Rooms open to your office</span><ul className="roomlist">
            {myNdas.length ? myNdas.map((n) => { const dd = byId.get(n.dealId); return dd ? (
              <li key={n.id}><div><b>{dd.company}</b><small>{dd.category} · NDA signed {fmtD(n.signedAt)}</small></div><a className="btn sm primary" href={`/room/${dd.slug}`}>Open room</a></li>) : null; })
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
              <td><span className="pill ok">Signed · version {n.version}</span></td><td>{fmtD(n.signedAt)}</td><td><div style={{ display: "flex", gap: 6 }}><a className="btn sm" href={`/dashboard/nda/${n.id}`}>View</a><a className="btn sm" href={`/dashboard/nda/${n.id}/pdf`} target="_blank" rel="noopener">PDF</a></div></td></tr>
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
            {st.requirePan && office.status !== "verified" && <p className="fine">Rooms open once the desk has checked the PAN.</p>}
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
            <form method="post" action="/api/auth/signout-all"><button className="btn sm ghost" type="submit">Sign out other devices</button></form>
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
      {welcome && (
        <dialog className="welcome" id="welcome" data-key={`omd_welcome_${office.id}`}>
          <form method="dialog" className="wl-x"><button className="btn sm ghost" aria-label="Close">✕</button></form>
          <span className="eyebrow live">You&apos;re in</span>
          <h2>Your office is approved</h2>
          <p>Every company on the desk is now open to you by name. A company&apos;s room opens with its own NDA, signed on screen; your PAN and investing entity are asked once, with the first one.</p>
          {profileGaps.length > 0 && (
            <form className="form wl-profile" method="post" action="/api/office/profile">
              <span className="k">First, two details for the desk</span>
              <div className="row">
                {!office.category && <label>The office invests as<select name="category" required defaultValue=""><option value="" disabled>Select</option><option>Individual</option><option>HUF</option><option>Private company</option><option>LLP</option><option>Trust</option><option>Family-office AIF</option><option>Other</option></select></label>}
                {!office.residency && <label>Residency<select name="residency" required defaultValue=""><option value="" disabled>Select</option><option>Resident in India</option><option>Non-resident (FEMA route applies)</option></select></label>}
                {!office.ticket && <label>Typical ticket per deal<select name="ticket" required defaultValue=""><option value="" disabled>Select</option><option>₹50 lakh – 1 crore</option><option>₹1–2 crore</option><option>₹2–5 crore</option><option>₹5–25 crore</option><option>Above ₹25 crore</option></select></label>}
              </div>
              <div><button className="btn" type="submit">Save</button></div>
            </form>
          )}
          <span className="k">Highest Desk Scores on the shelf</span>
          <ul className="roomlist">{[...deals].filter((d) => d.open).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3).map((d) => (
            <li key={d.id}><div><b>{d.company}</b><small>{d.category}{d.score != null ? ` · Desk Score ${d.score.toFixed(1)}` : ""}</small></div><a className="btn sm primary" href={`/nda/${d.slug}`}>Sign NDA</a></li>))}</ul>
          <form method="dialog"><button className="btn ghost sm">I&apos;ll look around first</button></form>
        </dialog>
      )}
    </div></div></main>
  );
}
