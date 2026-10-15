import { requireDesk } from "@/lib/auth";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { calls, dealLinks, deals, documents, ndas, offices, questions, users } from "@/db/schema";
import { saveDeal, saveDocument, answerQuestion, addQuestion, saveCall, requestPublish, addPromoter, removePromoter, createDealLink } from "@/lib/admin-actions";
import { SITE_URL } from "@/lib/site";
import { can } from "@/lib/perm";
import { toText } from "@/lib/pipes";
import { Msg } from "@/components/AdminBits";
import ART from "@/lib/deal-art.json";
import { dealInterest, STAGE_LABEL, type Stage } from "@/lib/interest";

const TA = ({ name, label, value, rows = 5, hint }: { name: string; label: string; value: string; rows?: number; hint?: string }) => (
  <label>{label}<textarea name={name} rows={rows} defaultValue={value} />{hint && <span className="hint">{hint}</span>}</label>
);
const IN = ({ name, label, value, hint, ph }: { name: string; label: string; value?: string | number | null; hint?: string; ph?: string }) => (
  <label>{label}<input name={name} defaultValue={value ?? ""} placeholder={ph} />{hint && <span className="hint">{hint}</span>}</label>
);

export default async function EditDeal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; link?: string }> }) {
  const me = await requireDesk();
  const id = Number((await params).id);
  const { msg, link: fresh } = await searchParams;
  const db = await getDb();
  const [d] = await db.select().from(deals).where(eq(deals.id, id));
  if (!d) notFound();
  const signedOffices = await db.select({ id: offices.id, name: offices.name }).from(ndas).innerJoin(offices, eq(offices.id, ndas.officeId)).where(eq(ndas.dealId, id));
  const [links, approvedOffices] = await Promise.all([
    db.select().from(dealLinks).where(eq(dealLinks.dealId, id)).orderBy(desc(dealLinks.createdAt)).limit(50),
    db.select({ id: offices.id, name: offices.name }).from(offices).where(eq(offices.approval, "approved")).orderBy(asc(offices.name)),
  ]);
  const officeName = new Map(approvedOffices.map((o) => [o.id, o.name]));
  const promoters = await db.select().from(users).where(and(eq(users.role, "promoter"), eq(users.promoterDealId, id), eq(users.disabled, false)));
  const [docs, qs, cs] = await Promise.all([
    db.select().from(documents).where(eq(documents.dealId, id)).orderBy(asc(documents.sort), asc(documents.id)),
    db.select().from(questions).where(eq(questions.dealId, id)).orderBy(desc(questions.askedAt)),
    db.select().from(calls).where(eq(calls.dealId, id)).orderBy(desc(calls.createdAt)),
  ]);
  const r = d.room;
  const pub = can(me, "deals.publish"), del = can(me, "delete");
  const interest = await dealInterest(d.id);
  const fmt = (x: Date | null) => x ? x.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "";
  const artKey = Object.entries(ART as Record<string, string>).find(([, v]) => v === d.art)?.[0] || "";
  return (
    <>
      <Msg msg={msg} />
      <p className="crumb"><a href="/admin/deals">← All deals</a> · <a href={`/deals/${d.slug}`}>Public overview</a> · <a href={`/room/${d.slug}`}>Room</a> · <a href={`/admin/pipeline?deal=${d.slug}`}>Pipeline</a> · <a href="#promoters">Promoter access</a></p>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>{d.company}</h1>
      <h2 id="interest" style={{ marginTop: 14 }}>Who is how interested</h2>
      <p className="fine">The three layers, read back: who looked, who opened the pitch deck, who signed the NDA, who went into the data bank and who asked for an allocation. An office counts in every layer it has passed.{interest.anon ? ` The overview was also opened ${interest.anon} ${interest.anon === 1 ? "time" : "times"} by visitors not signed in.` : ""}</p>
      <div className="funnel-row">{(["viewed", "deck", "nda", "databank", "asked"] as Stage[]).map((k) => <div key={k}><b>{interest.counts[k]}</b><span>{STAGE_LABEL[k]}</span></div>)}</div>
      {interest.rows.length > 0 && <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Office</th><th>Furthest</th><th>Looked</th><th>Deck</th><th>Data bank</th><th>Last</th></tr></thead><tbody>
        {interest.rows.map((x) => <tr key={x.officeId}><td><b>{x.name}</b></td><td><span className={`pill ${x.stage === "asked" || x.stage === "databank" ? "ok" : x.stage === "nda" ? "mid" : ""}`}>{STAGE_LABEL[x.stage]}</span></td><td>{x.views || "—"}</td><td>{x.decks ? `${x.decks}×` : "—"}</td><td>{x.banks ? `${x.banks}×` : "—"}</td><td className="mono">{fmt(x.last)}</td></tr>)}
      </tbody></table></div>}
      <p className="fine" style={{ marginBottom: 16 }}>Lists take one item per line, with fields separated by a vertical bar ( | ). Statuses are done, in progress or pending. Never put the floor valuation, fees or confidential process detail anywhere here.</p>

      <form action={saveDeal} className="form adm-form">
        <input type="hidden" name="id" value={d.id} />
        <h2>On the shelf and the public overview</h2>
        <div className="row"><IN name="company" label="Company (shown only to registered offices)" value={d.company} /><IN name="title" label="Public title (anonymised)" value={d.title} /></div>
        <TA name="headline" label="One-line description (anonymised, public)" value={d.headline} rows={2} />
        <div className="row"><label>Structure<select name="category" defaultValue={d.category}><option>Pre-IPO primary</option><option>Pre-IPO secondary</option><option>Growth round</option><option>SME IPO anchor</option></select></label>
          <IN name="stage" label="Tag on the card" value={d.stage} ph="Room open" /></div>
        <div className="row"><IN name="status" label="Status line" value={d.status} /><IN name="asOf" label="Score and tracker as of" value={d.asOf} ph="12 Oct 2026" /></div>
        <div className="row"><IN name="score" label="Desk Score (out of 10)" value={d.score ?? ""} ph="8.4" hint="Shown on the card and overview; leave empty to show 'assessment in progress'" /><span /></div>
        <div className="row"><IN name="listingLabel" label="Target listing (label)" value={d.listingLabel} ph="Sept 2028" /><IN name="listingMonth" label="Target listing month" value={d.listingMonth} ph="2028-09" hint="YYYY-MM; leave empty if not set" /></div>
        <div className="row"><IN name="listingNote" label="Listing note" value={d.listingNote} ph="main board" /><IN name="sort" label="Order on the shelf" value={d.sort} /></div>
        <div className="row"><IN name="roundLabel" label="Round (registered offices)" value={d.roundLabel} /><IN name="preMoney" label="Pre-money" value={d.preMoney} /></div>
        <div className="row"><IN name="roundCr" label="Round size, ₹ crore (allocation book)" value={d.roundCr ?? ""} ph="50" hint="Used for coverage in the Pipeline; read from the round label when empty" /><span /></div>
        <div className="row"><IN name="peLabel" label="P/E trailing · forward" value={d.peLabel} /><IN name="minTicket" label="Minimum ticket" value={d.minTicket} /></div>
        <IN name="dataRoomUrl" label="Data bank: Google Drive folder link (layer 3, opens only from the NDA room)" value={d.dataRoomUrl} ph="https://drive.google.com/drive/folders/…" hint="Share the folder as 'Anyone with the link · Viewer' with downloading, printing and copying switched off (Drive: Share → Settings). Offices reach it only through the room, and every open is logged by name and office. Leave empty to show 'coming'." />
        <div className="row"><label>Card illustration<select name="artKey" defaultValue={artKey}>{Object.keys(ART).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <IN name="ndaVersion" label="NDA version" value={d.ndaVersion} hint="Change it when the NDA text changes" /></div>
        {pub ? <>
        <label className="chk"><input type="checkbox" name="published" defaultChecked={d.published} /> Published (shown on the site). Unticked: in preparation, visible to the desk only.</label>
        {!d.published && <label className="chk"><input type="checkbox" name="announce" defaultChecked /> When I publish it, tell every approved office (in the app, and by email once email is set up)</label>}
        <label className="chk"><input type="checkbox" name="open" defaultChecked={d.open} /> Room open (offices can sign the NDA and enter)</label>
        </> : <p className="notice adm-locked"><b>{d.published ? "Published" : "Hidden draft"}</b> · {d.open ? "room open" : "room closed"}. Publishing and opening the room are done by a super admin; use <a href="#ask-publish">Ask to publish</a> below the form when it is ready.</p>}
        <TA name="publicRisks" label="Short risk list (kept for the desk; no longer shown publicly, the room's risks are under In the room)" value={toText.list(d.publicRisks)} rows={3} />

        <h2>In the room</h2>
        <TA name="lede" label="Lede under the company name" value={r.lede} rows={2} />
        <TA name="why" label="Why it is on the desk" value={r.why} rows={2} />
        <div className="row"><IN name="round" label="Round line" value={r.round} /><IN name="ticket" label="Family office ticket" value={r.ticket} /></div>
        <IN name="committed" label="Committed so far (optional)" value={r.committed} />
        <TA name="snapshot" label="Snapshot: label | value | note" value={toText.cells(r.snapshot)} rows={6} />
        <TA name="risks" label="Key risks: title | text" value={toText.risks(r.risks)} rows={7} />
        <TA name="feed" label="What changed: date | text (newest first)" value={toText.feed(r.feed)} rows={5} />
        <TA name="fin" label="Financials table: first line Year | FY25 | FY26 ..., then label | values" value={toText.fin(r.fin)} rows={6} />
        <div className="row"><IN name="finUnit" label="Financials unit" value={r.fin?.unit} ph="₹ Cr" /><IN name="peers" label="Listed peers" value={r.peers} /></div>
        <TA name="finNote" label="Note under the financials (sources, audit status)" value={r.fin?.note || ""} rows={2} />
        <TA name="pe" label="P/E chart: label | note | number" value={toText.pe(r.pe || [])} rows={3} />
        <TA name="multiples" label="Multiples: label | value | note" value={toText.cells(r.multiples)} rows={4} />
        <TA name="terms" label="Terms: label | text" value={toText.terms(r.terms)} rows={8} />
        <TA name="path" label="IPO path: status | milestone | note" value={toText.path(r.path)} rows={6} />
        <TA name="checks" label="Desk diligence tracker: status | check | note | date" value={toText.checks(r.checks)} rows={9} />
        <TA name="mine" label="Office checklist (one per line)" value={toText.list(r.mine)} rows={4} />
        <div className="row"><TA name="alerts" label="Alert options" value={toText.list(r.alerts)} rows={4} /><TA name="passReasons" label="Pass reasons" value={toText.list(r.passReasons)} rows={4} /></div>
        <details><summary>Advanced: charts, stake, allocation slider and scenario (JSON)</summary>
          <TA name="highlight" label="Highlight donut (optional)" value={r.highlight ? JSON.stringify(r.highlight, null, 1) : ""} rows={4} />
          <TA name="stake" label="Stake bar: sizeCr, postCr (optional)" value={r.stake ? JSON.stringify(r.stake) : ""} rows={1} />
          <TA name="interest" label="Allocation slider" value={JSON.stringify(r.interest, null, 1)} rows={5} />
          <TA name="scenario" label="Scenario calculator (optional)" value={r.scenario ? JSON.stringify(r.scenario, null, 1) : ""} rows={5} />
        </details>

        <h2 id="ipo">Road to listing (offices that hold shares see this)</h2>
        <p className="fine">Fill each date as it happens; holders are told when a step is added. Dates as YYYY-MM-DD.</p>
        <div className="row3"><IN name="ipo_closed" label="Round closed, shares allotted" value={d.ipo.closed} ph="2026-11-20" /><IN name="ipo_drhp" label="Draft offer document filed" value={d.ipo.drhp} /><IN name="ipo_sebi" label="SEBI observations / exchange approval" value={d.ipo.sebi} /></div>
        <div className="row3"><IN name="ipo_rhp" label="Price band announced" value={d.ipo.rhp} /><IN name="ipo_priceBand" label="Price band" value={d.ipo.priceBand} ph="₹420–440" /><IN name="ipo_listing" label="Listing date" value={d.ipo.listing} /></div>
        <div className="row3"><IN name="ipo_listPrice" label="Listing-day close, ₹ per share" value={d.ipo.listPrice ?? ""} /><IN name="ipo_lastPrice" label="Latest price, ₹ per share" value={d.ipo.lastPrice ?? ""} /><IN name="ipo_lastAt" label="Latest price as of" value={d.ipo.lastAt} /></div>
        <IN name="ipo_note" label="One line for holders (optional)" value={d.ipo.note} ph="SEBI observations received; RHP expected in March" />
        <label className="chk"><input type="checkbox" name="promoterDemand" defaultChecked={d.promoterDemand} /> Show the promoter the total amount indicated (founder portal). Off: they see activity counts only.</label>
        <div className="adm-save"><button className="btn primary" type="submit">Save deal</button></div>
      </form>
      {!pub && (
        <form action={requestPublish} className="form adm-card" id="ask-publish"><input type="hidden" name="id" value={d.id} />
          <b>Ask a super admin to {!d.published ? "publish this deal" : !d.open ? "open the room" : "review this deal"}</b>
          <label>Note (optional)<input name="note" maxLength={600} placeholder="e.g. Numbers updated to FY26 audited; ready to go live" /></label>
          <div><button className="btn sm primary" type="submit">Send the request</button></div>
        </form>)}

      <h2 id="share">Send this deal to an office</h2>
      <p className="fine">A personal link that opens this deal&apos;s NDA. An office on the desk goes straight there once signed in. Someone new registers with their details filled in and their office approved, then lands on the NDA. Send it on WhatsApp or email yourself; the message names the sector, not the company.</p>
      <form action={createDealLink} className="form adm-card" id="make-link"><input type="hidden" name="dealId" value={d.id} />
        <label>An office on the desk<select name="officeId" defaultValue=""><option value="">— or someone new, below —</option>{approvedOffices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <div className="row3"><label>Name<input name="name" maxLength={120} /></label><label>Email<input name="email" type="email" maxLength={200} /></label><label>Family office<input name="officeName" maxLength={160} /></label></div>
        <div><button className="btn sm primary" type="submit">Make the link</button></div>
      </form>
      {links.length > 0 && <div className="cmpwrap"><table className="cmp plain dl-t"><thead><tr><th>For</th><th>Made</th><th>Opened</th><th>Link</th></tr></thead><tbody>
        {links.map((l) => {
          const url = `${SITE_URL}/go/${l.token}`;
          const who = l.officeId ? officeName.get(l.officeId) ?? `Office #${l.officeId}` : `${l.name}${l.officeName ? `, ${l.officeName}` : ""}`;
          const text = `${l.officeId ? "" : `${(l.name || "").split(" ")[0]}, `}a company the desk would like you to see: ${d.title} (${d.category}), target listing ${d.listingLabel}. It opens here: ${url}`;
          return <tr key={l.id} className={l.token === fresh ? "dl-new" : ""}><td><b>{who}</b>{!l.officeId && <small className="fine"><br />new · {l.registeredAt ? "registered, approved" : "not registered yet"}</small>}</td>
            <td>{l.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} · {l.createdBy}</td>
            <td>{l.opens ? `${l.opens}× · last ${l.openedAt?.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : "Not yet"}</td>
            <td><div className="dl-acts"><input readOnly value={url} aria-label={`Link for ${who}`} /><button type="button" className="btn sm" data-copy={url}>Copy</button>
              <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">WhatsApp</a></div></td></tr>; })}
      </tbody></table></div>}

      <h2 id="promoters">Promoter access (founder portal)</h2>
      <p className="fine">The company&apos;s promoters sign in to see how the round is going: overview views, NDAs, room activity and questions, never which offices. They draft answers and suggest documents; nothing reaches offices until the desk posts it.{d.promoterDemand ? " They also see the total amount indicated." : " They do not see amounts (tick the box under Road to listing to show the total)."}</p>
      <ul className="feed">{promoters.length ? promoters.map((p) => (
        <li key={p.id}><b>{p.name}</b> · {p.email} · last sign-in {p.lastLoginAt ? p.lastLoginAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "never"}
          <form action={removePromoter} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /> <button className="btn sm ghost" type="submit">Remove access</button></form></li>))
        : <li className="empty-li">No promoter has access yet.</li>}</ul>
      <form action={addPromoter} className="form adm-card" id="add-promoter"><input type="hidden" name="dealId" value={d.id} />
        <div className="row3"><label>Name<input name="name" required maxLength={120} /></label><label>Email<input name="email" type="email" required maxLength={200} /></label>
          <label>Temporary password<input name="password" minLength={8} maxLength={200} autoComplete="off" placeholder="8 characters or more" /></label></div>
        <div><button className="btn sm primary" type="submit">Give founder portal access</button> <a className="btn sm ghost" href={`/founder?deal=${d.slug}`}>See what they see</a></div>
      </form>

      <h2 id="docs">Documents</h2>
      <p className="fine">Paste a link to the file (for example a Google Drive file shared with “anyone with the link”, or any secure URL). Investors only reach it through the site, and every open is logged. Status “on request” shows the file exists but is shared only with offices that indicate interest.
        Choose who sees each file: <b>every approved investor, before the NDA</b> (the pitch deck, IM or teaser: shown on the deal&apos;s public overview to approved investors, layer 2), every office that signed this NDA (layer 3), only offices that requested an allocation (for a draft term sheet, say: others see it listed as opening after their request), or only the offices you pick (hold Ctrl or Cmd to pick several).</p>
      {[...docs, null].map((doc, i) => (
        <form key={doc?.id ?? "new"} action={saveDocument} className="form adm-row">
          <input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="id" value={doc?.id ?? 0} />
          {doc?.status === "proposed" && <span className="pill mid" title={`Suggested by ${doc.proposedBy ?? "the promoter"} from the founder portal`}>From the promoter</span>}
          <input name="title" defaultValue={doc?.title} placeholder={doc ? "" : "New document title"} required={!doc} />
          <input name="kind" defaultValue={doc?.kind ?? ""} placeholder="PDF · 48 pp" style={{ maxWidth: 130 }} />
          <select name="status" defaultValue={doc?.status ?? "available"}><option value="available">Available</option><option value="on_request">On request</option><option value="requested">Requested from company</option>{doc?.status === "proposed" && <option value="proposed">Proposed by the promoter (hidden)</option>}</select>
          <input name="url" defaultValue={doc?.url ?? ""} placeholder="https://… link to the file" />
          <select name="audience" defaultValue={doc?.audience ?? "nda"} title="Who sees it">
            <option value="approved">Every approved investor, before the NDA (pitch deck, IM)</option><option value="nda">All offices with the NDA</option><option value="allocation">Only offices that requested an allocation</option><option value="offices">Only the offices selected</option></select>
          <select name="officeIds" multiple defaultValue={(doc?.officeIds ?? []).map(String)} title="Selected offices (hold Ctrl/Cmd to pick several)" className="adm-multi">
            {signedOffices.length ? signedOffices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>) : <option disabled value="">No office has signed this NDA yet</option>}</select>
          <input name="sort" defaultValue={doc?.sort ?? 100 + i} style={{ maxWidth: 60 }} />
          {doc && del && <label className="chk"><input type="checkbox" name="delete" /> delete</label>}
          <button className="btn sm" type="submit">{doc ? "Save" : "Add"}</button>
        </form>
      ))}

      <h2 id="qa">Q&amp;A</h2>
      {qs.map((q) => (
        <form key={q.id} action={answerQuestion} className="form adm-card">
          <input type="hidden" name="id" value={q.id} /><input type="hidden" name="back" value={`/admin/deals/${d.id}#qa`} />
          <label>Question{q.officeId ? (q.private ? " (private to the office that asked)" : " (from an office)") : ""}<input name="question" defaultValue={q.question} /></label>
          <div className="row"><label>Answer<textarea name="answer" rows={2} defaultValue={q.answer ?? q.draftAnswer ?? ""} />{!q.answer && q.draftAnswer && <span className="hint">Drafted by the promoter; save to post it.</span>}</label><label>Answered by<input name="by" defaultValue={q.answeredBy ?? "Promoter"} /></label></div>
          <label className="chk"><input type="checkbox" name="hidden" defaultChecked={q.hidden} /> Hide from the room</label>
          <div><button className="btn sm" type="submit">Save</button></div>
        </form>
      ))}
      <form action={addQuestion} className="form adm-card"><input type="hidden" name="dealId" value={d.id} />
        <label>Add a question and answer to the room<input name="question" placeholder="Question" /></label>
        <div className="row"><label>Answer<textarea name="answer" rows={2} /></label><label>Answered by<input name="by" defaultValue="Promoter" /></label></div>
        <div><button className="btn sm" type="submit">Add</button></div></form>

      <h2 id="calls">Calls and promoter sessions</h2>
      {[...cs, null].map((c) => (
        <form key={c?.id ?? "new"} action={saveCall} className="form adm-card">
          <input type="hidden" name="id" value={c?.id ?? 0} /><input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="back" value={`/admin/deals/${d.id}#calls`} />
          {c?.kind === "request" ? <p className="fine">Requested by an office · {c.slot} · {c.attendees}{c.questions ? ` · “${c.questions}”` : ""}</p> : <p className="fine">{c ? "Group session" : "Schedule a group session for every office with this NDA"}</p>}
          <div className="row"><label>Title<input name="title" defaultValue={c?.title ?? ""} placeholder="Promoter session" /></label>
            <label>Status<select name="status" defaultValue={c?.status ?? "Scheduled"}><option>Requested</option><option>Scheduled</option><option>Held</option><option>Declined</option></select></label></div>
          <div className="row"><label>When<input name="scheduledFor" defaultValue={c?.scheduledFor ?? ""} placeholder="16 Oct 2026, 4:00 pm" /></label><label>Written summary<textarea name="summary" rows={2} defaultValue={c?.summary ?? ""} /></label></div>
          <div><button className="btn sm" type="submit">{c ? "Save" : "Add session"}</button></div>
        </form>
      ))}
    </>
  );
}
