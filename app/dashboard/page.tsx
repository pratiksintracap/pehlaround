import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { audit, calls, docViews, documents, interests, invites, ndas, passes, questions, users } from "@/db/schema";
import { listDeals, canSeeNames } from "@/lib/deals";
import { monthsTo } from "@/lib/render";
import { AppPromo } from "@/components/AppPromo";
import { GRIEVANCE, DESK_EMAIL } from "@/lib/site";
import { parsePromises, answerStats } from "@/lib/promises";
import { Analyst } from "@/components/Analyst";
import { aiReady, starters } from "@/lib/ai";
import { AUM, CATEGORY, HORIZON, RESIDENCY, SECTORS, STRUCTURES, TICKET, completeness, fit } from "@/lib/profile";

export const metadata: Metadata = { title: "Your office", robots: { index: false } };
type P = { searchParams: Promise<{ msg?: string; error?: string }> };

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

const PR_ICONS = [
  "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3", // lock open
  "M4 5h16v11H9l-5 4zM8 9h8M8 12h5", // question
  "M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z", // phone
  "M4 12l5 5L20 6", // tick
  "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5", // document
  "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", // eye
  "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z", // shield
  "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", // clock
];

export default async function Dashboard({ searchParams }: P) {
  const user = await requireUser("/dashboard");
  if (user.role === "admin" && !user.officeId) redirect("/admin");
  const { msg, error } = await searchParams;
  const office = user.office!;
  const db = await getDb();
  const [allDeals, names, st, ans] = await Promise.all([listDeals(), canSeeNames(user), getSettings(), answerStats()]);
  const promises = parsePromises(st.promises);
  const aiOn = aiReady() && st.aiAnalyst && names;
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
  // deals this office has passed on (its latest word on the deal, unless it asked for an allocation after passing)
  const lastAsk = new Map<number, Date>(); for (const i of myInterests) if (!lastAsk.has(i.dealId)) lastAsk.set(i.dealId, i.createdAt);
  const passedBy = new Map<number, (typeof myPasses)[number]>(), seenPass = new Set<number>();
  for (const p of myPasses) { if (seenPass.has(p.dealId)) continue; seenPass.add(p.dealId); const a = lastAsk.get(p.dealId); if (!a || a < p.createdAt) passedBy.set(p.dealId, p); }
  // the room this office was in last (from its own log), else the NDA it signed most recently; never one it passed on
  const live = (id: number | null) => !!id && signed.has(id) && !passedBy.has(id);
  const lastOpened = log.find((l) => live(l.dealId) && l.action.startsWith("Opened the room")) ?? log.find((l) => live(l.dealId));
  const latest = byId.get(lastOpened?.dealId ?? myNdas.find((n) => !passedBy.has(n.dealId))?.dealId ?? -1);
  const topPick = [...deals].filter((d) => d.open && !signed.has(d.id)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  // progress: four steps, shown until the office has a room open
  const steps: [string, string, "done" | "now" | "todo"][] = [
    ["Registered", "Your office is on the desk", "done"],
    ["Approved", names ? "Every company is open to you by name" : "The desk reviews new offices, usually within a working day", names ? "done" : "now"],
    ["First NDA signed", signed.size ? "Signed with your name and an email code" : "Your name and a code we email you; nothing else", signed.size ? "done" : names ? "now" : "todo"],
    ["Rooms open", signed.size ? `${signed.size} ${signed.size === 1 ? "room" : "rooms"} open to you` : "Numbers, documents and Q&A for each company", signed.size ? "done" : "todo"],
  ];
  const showSteps = !signed.size;
  const profileGaps = [!office.category && "category", !office.residency && "residency", !office.ticket && "ticket"].filter(Boolean) as string[];
  const welcome = names && !signed.size; // approved but no room yet: the welcome pop-up guides the first step
  const canCommit = /commit/i.test(user.rights);
  const prof = completeness(office);
  const fits = new Map(deals.map((d) => [d.id, fit(office, d)]));
  const NAV: [string, string, string, number | null][] = [
    ["Shelf", "Deals", "M3 7h18M3 12h18M3 17h12", deals.filter((d) => d.open).length],
    ["Rooms", "My rooms", "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21v-6h6v6", signed.size || null],
    ["Calls", "Calls", "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2", null],
    ["Documents", "Documents", "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h6", null],
    ["Portfolio", "Portfolio", "M4 19V9M10 19V5M16 19v-7M22 19H2", allotted.length || null],
    ["Profile", "Investment profile", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", null],
    ["Team", "Team", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8", team.length > 1 ? team.length : null],
    ["Log", "Activity log", "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z", null],
  ];

  return (
    <main><div className="wrap app-wrap"><div className="app" id="dash">
      <aside className="app-side" aria-label="Your office">
        <div className="as-office">
          <span className="as-av" aria-hidden="true">{office.name.trim().slice(0, 1).toUpperCase()}</span>
          <div><b>{office.name}</b><small>{names ? "Approved by the desk" : "Awaiting approval"}{office.city ? ` · ${office.city}` : ""}</small></div>
        </div>
        <a className="as-prof" href="#Profile" title={prof.missing.length ? `Still to add: ${prof.missing.join(", ")}` : "Your profile is complete"}>
          <span><b>Investment profile</b><small>{prof.pct === 100 ? "Complete" : `${prof.pct}% complete · add ${prof.missing[0].toLowerCase()}`}</small></span>
          <i className="as-meter" aria-hidden="true"><i style={{ width: `${prof.pct}%` }} /></i>
        </a>
        <nav className="side-nav" role="tablist" aria-label="Dashboard sections">
          {NAV.map(([k, t, ic, n], i) => (
            <button key={k} role="tab" type="button" className="tabbtn" data-tab={k} aria-selected={i === 0}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ic} /></svg><span>{t}</span>{n ? <em>{n}</em> : null}</button>))}
        </nav>
        {aiOn && <button type="button" className="as-ai" data-open-analyst=""><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8zM18.5 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" /></svg><span><b>Ask the analyst</b><small>AI on your rooms, peers and sectors</small></span></button>}
        <div className="as-foot">
          <a href="/app?install=1" data-get-app="">Get the app</a>
          <a href={`mailto:${DESK_EMAIL}`}>Write to the desk</a>
        </div>
      </aside>
      <div className="app-main">
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
              : null}
          </div>
        </section>
      )}


      <section className="panel" data-panel="Shelf">
        <div className="cmpwrap"><table className="cmp plain" id="shelf-t"><thead><tr><th>Deal</th><th>Structure</th><th>Target listing</th><th>Round</th><th>Pre-money</th><th>P/E trailing · forward</th><th>Min ticket</th><th>Desk Score</th><th /></tr></thead>
          <tbody>{deals.map((d) => (
            <tr key={d.id} data-struct={d.category} data-months={monthsTo(d.listingMonth) ?? 999}>
              <th scope="row">{d.company}{names && <><br /><small className="fine">{d.title}</small></>}<br />
                {passedBy.has(d.id) ? <span className="pill off" title={`Passed: ${passedBy.get(d.id)!.reason}`}>Passed</span>
                  : <span className={`pill ${signed.has(d.id) ? "ok" : ""}`}>{signed.has(d.id) ? "NDA signed" : d.open ? "Room open" : "Not open"}</span>}{!passedBy.has(d.id) && fits.get(d.id) && <span className="fitpill" title={fits.get(d.id)!}>Fits your thesis</span>}</th>
              <td>{d.category}</td><td>{d.listingLabel}{d.listingNote ? ` · ${d.listingNote}` : ""}</td><td>{d.roundLabel || "—"}</td><td>{d.preMoney || "—"}</td><td>{d.peLabel || "—"}</td><td>{d.minTicket || "—"}</td><td>{d.score != null ? <b>{d.score.toFixed(1)}</b> : "—"}</td>
              <td><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {signed.has(d.id) ? <a className="btn sm primary" href={`/room/${d.slug}`}>Open room</a> : d.open && names ? <a className="btn sm primary" href={`/nda/${d.slug}`}>Sign NDA</a> : null}
                <a className="btn sm" href={`/deals/${d.slug}`}>Overview</a></div></td>
            </tr>
          ))}</tbody></table></div>
        <ul className="dash-cards">{deals.map((d) => (
          <li key={d.id}>
            <div className="dc-top"><b>{d.company}</b>{passedBy.has(d.id) ? <span className="pill off">Passed</span> : <span className={`pill ${signed.has(d.id) ? "ok" : ""}`}>{signed.has(d.id) ? "NDA signed" : d.open ? "Room open" : "Not open"}</span>}</div>
            <small>{names ? `${d.title} · ` : ""}{d.category}</small>{!passedBy.has(d.id) && fits.get(d.id) && <span className="fitpill">{fits.get(d.id)}</span>}
            <dl><div><dt>Round</dt><dd>{d.roundLabel || "—"}</dd></div><div><dt>Pre-money</dt><dd>{d.preMoney || "—"}</dd></div>
              <div><dt>P/E</dt><dd>{d.peLabel || "—"}</dd></div><div><dt>Listing</dt><dd>{d.listingLabel}</dd></div>{d.score != null && <div><dt>Desk Score</dt><dd>{d.score.toFixed(1)} / 10</dd></div>}</dl>
            <div className="dc-acts">
              {signed.has(d.id) ? <a className="btn sm primary" href={`/room/${d.slug}`}>Open room</a> : d.open && names ? <a className="btn sm primary" href={`/nda/${d.slug}`}>Sign NDA</a> : null}
              <a className="btn sm" href={`/deals/${d.slug}`}>Overview</a></div>
          </li>))}</ul>
        <p className="fine">Same fields for every deal so offices can compare quickly.</p>
        {promises.length > 0 && (
          <section className="promises" id="promises" aria-label="What the desk commits to">
            <div className="pr-head"><h2 className="tt">What the desk commits to.<span className="tt2">Hold us to it.</span></h2>
              <a className="btn sm ghost" href={`mailto:${DESK_EMAIL}?subject=${encodeURIComponent("A commitment the desk missed")}`}>Tell us if we miss one</a></div>
            <ul className="pr-grid">{promises.map((p, i) => {
              const measured = ans && /question|answer/i.test(p.title);
              return (
                <li key={p.title}><span className="pr-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={PR_ICONS[i % PR_ICONS.length]} /></svg></span>
                  <div><b>{p.title}</b>{p.detail && <p>{p.detail}</p>}
                    {measured && ans && <span className="pr-live" title={`${ans.count} questions answered in the last 90 days`}><i />Last 90 days: median {ans.medianHours < 1 ? "under an hour" : `${Math.round(ans.medianHours)} hours`} · {Math.round(ans.within48 * 100)}% within 48 hours</span>}</div></li>);
            })}</ul>
          </section>
        )}
        <AppPromo variant="bar" text="New deals, promoter answers and approvals on your home screen, the moment they land." />
      </section>

      <section className="panel" data-panel="Rooms" hidden>
        <div className="two">
          <div className="chart"><span className="k">Rooms open to your office</span><ul className="roomlist">
            {myNdas.length ? [...myNdas].sort((a, b) => Number(passedBy.has(a.dealId)) - Number(passedBy.has(b.dealId))).map((n) => { const dd = byId.get(n.dealId), ps = passedBy.get(n.dealId); return dd ? (
              <li key={n.id} className={ps ? "passed" : undefined}><div><b>{dd.company}{ps && <> <span className="pill off">Passed</span></>}</b>
                <small>{dd.category} · {ps ? `Passed ${fmtD(ps.createdAt)}: “${ps.reason}”` : `NDA signed ${fmtD(n.signedAt)}`}</small></div>
                <a className={`btn sm ${ps ? "" : "primary"}`} href={`/room/${dd.slug}`}>Open room</a></li>) : null; })
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

      <section className="panel" data-panel="Profile" hidden>
        <div className="panel-head"><div><h2>Investment profile</h2><p className="fine">What your office looks for. The desk uses it to bring you the right companies, and the shelf marks the deals that fit. Seen only by your office and the desk.</p></div>
          <div className="ph-meter"><b>{prof.pct}%</b><small>complete</small></div></div>
        <form className="form profform" method="post" action="/api/office/profile">
          <input type="hidden" name="mode" value="full" />
          <fieldset disabled={!canCommit}>
          <div className="pf-card"><span className="k">The office</span>
            <div className="row3">
              <label>City<input name="city" maxLength={80} defaultValue={office.city || ""} placeholder="Mumbai" /></label>
              <label>Website<input name="website" maxLength={200} defaultValue={office.website || ""} placeholder="shahfamilyoffice.in" /></label>
              <label>Invests as<select name="category" defaultValue={office.category || ""}><option value="" disabled>Select</option>{CATEGORY.map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
            <div className="row3">
              <label>Residency<select name="residency" defaultValue={office.residency || ""}><option value="" disabled>Select</option>{RESIDENCY.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>Assets under management<select name="aum" defaultValue={office.aum || ""}><option value="">Select</option>{AUM.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>Typical ticket per deal<select name="ticket" defaultValue={office.ticket || ""}><option value="" disabled>Select</option>{TICKET.map((x) => <option key={x}>{x}</option>)}</select></label>
            </div>
          </div>
          <div className="pf-card"><span className="k">Your thesis</span>
            <label className="pf-l">Sectors you invest in</label>
            <div className="chips">{SECTORS.map(([n]) => <label key={n} className="chipbox"><input type="checkbox" name="sectors" value={n} defaultChecked={(office.sectors || []).includes(n)} /><span>{n}</span></label>)}</div>
            <label className="pf-l">Deal structures</label>
            <div className="chips">{STRUCTURES.map((n) => <label key={n} className="chipbox"><input type="checkbox" name="structures" value={n} defaultChecked={(office.structures || []).includes(n)} /><span>{n}</span></label>)}</div>
            <div className="row3">
              <label>Holding horizon<select name="horizon" defaultValue={office.horizon || ""}><option value="">Select</option>{HORIZON.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="chk" style={{ alignSelf: "end" }}><input type="checkbox" name="coLead" defaultChecked={office.coLead} /> Open to co-leading a round</label>
            </div>
            <label>Investment thesis, in your words<textarea name="thesis" rows={4} maxLength={1500} defaultValue={office.thesis || ""} placeholder="e.g. Profitable manufacturers with export revenue, entering 2–3 years before a main-board listing, at a clear discount to listed peers. We avoid lending businesses and anything pre-profit." /></label>
          </div>
          {canCommit ? <div><button className="btn primary" type="submit">Save profile</button>{office.profileAt && <span className="fine" style={{ marginLeft: 10 }}>Last saved {fmtD(office.profileAt)}</span>}</div>
            : <p className="fine">Only people with commit rights can change the profile.</p>}
          </fieldset>
        </form>
        <div className="two" style={{ marginTop: 16 }}>
          <div className="chart"><span className="k">How signing works</span>
            <p className="fine" style={{ marginTop: 6 }}>Each company&apos;s NDA is signed with the signatory&apos;s name and a one-time code emailed to them. No PAN or ID is needed to look at deals; KYC for the investing entity comes only when your office invests.</p>
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
        </div>
      </section>

      <section className="panel" data-panel="Team" hidden>
        <div className="panel-head"><div><h2>Team</h2><p className="fine">Everyone from your office on the desk. Each deal&apos;s NDA covers your office&apos;s team for that deal, and every view is logged against a name.</p></div></div>
        <div className="chart">
          <div className="cmpwrap"><table className="cmp plain" style={{ minWidth: 0 }}><thead><tr><th>Name</th><th>Role</th><th>Rights</th></tr></thead><tbody>
            {team.map((t) => <tr key={t.id}><th scope="row">{t.name}<br /><small className="fine">{t.email}</small></th><td>{t.officeRole || "—"}</td><td>{t.rights}</td></tr>)}
            {pending.map((p) => <tr key={`i${p.id}`}><th scope="row">{p.email}</th><td>Invited</td><td>{p.rights}</td></tr>)}
          </tbody></table></div>
          {canCommit && <form className="form" method="post" action="/api/office/invite" style={{ marginTop: 10 }}>
            <div className="row"><label>Email<input type="email" name="email" required placeholder="name@office.in" /></label>
              <label>Rights<select name="rights" defaultValue="View"><option>View</option><option>View, comment</option><option>View, comment, commit</option></select></label></div>
            <div><button className="btn" type="submit">Add a person</button></div>
            <p className="fine">They join your office when they register with this email.</p>
          </form>}
        </div>
        <div style={{ marginTop: 12 }}><form method="post" action="/api/auth/signout-all"><button className="btn sm ghost" type="submit">Sign out other devices</button></form></div>
      </section>

      <section className="panel" data-panel="Log" hidden>
        <div className="cmpwrap"><table className="cmp"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>
          {log.map((l) => <tr key={l.id}><td>{fmtT(l.at)}</td><td>{l.who || "—"}</td><td>{l.action}</td></tr>)}
        </tbody></table></div>
        <p className="fine">The log shows the desk offered each deal only to identified people, which is what the private placement rules require.</p>
      </section>
      </div>
      {welcome && (
        <dialog className="welcome" id="welcome" data-key={`omd_welcome_${office.id}`}>
          <form method="dialog" className="wl-x"><button className="btn sm ghost" aria-label="Close">✕</button></form>
          <span className="eyebrow live">You&apos;re in</span>
          <h2>Your office is approved</h2>
          <p>Every company on the desk is now open to you by name. Open a company&apos;s room by signing its NDA on screen with your name and a code we email you.</p>
          {promises.length > 0 && <ul className="ticks wl-prom" aria-label="What the desk commits to">{promises.slice(0, 3).map((p) => <li key={p.title}>{p.title}</li>)}</ul>}
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
          <p className="fine" style={{ marginTop: 12 }}>Tell the desk what you look for in <a href="#Profile" data-close-welcome="">your investment profile</a> and the shelf will mark the deals that fit.</p>
          <form method="dialog"><button className="btn ghost sm">I&apos;ll look around first</button></form>
        </dialog>
      )}
    </div></div>
    {aiOn && <Analyst deal={null} starters={starters(null)} who={user.name} />}
    </main>
  );
}
