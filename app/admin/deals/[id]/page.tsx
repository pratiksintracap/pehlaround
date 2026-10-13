import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { calls, deals, documents, ndas, offices, questions } from "@/db/schema";
import { saveDeal, saveDocument, answerQuestion, addQuestion, saveCall } from "@/lib/admin-actions";
import { toText } from "@/lib/pipes";
import { Msg } from "@/components/AdminBits";
import ART from "@/lib/deal-art.json";

const TA = ({ name, label, value, rows = 5, hint }: { name: string; label: string; value: string; rows?: number; hint?: string }) => (
  <label>{label}<textarea name={name} rows={rows} defaultValue={value} />{hint && <span className="hint">{hint}</span>}</label>
);
const IN = ({ name, label, value, hint, ph }: { name: string; label: string; value?: string | number | null; hint?: string; ph?: string }) => (
  <label>{label}<input name={name} defaultValue={value ?? ""} placeholder={ph} />{hint && <span className="hint">{hint}</span>}</label>
);

export default async function EditDeal({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const { msg } = await searchParams;
  const db = await getDb();
  const [d] = await db.select().from(deals).where(eq(deals.id, id));
  if (!d) notFound();
  const signedOffices = await db.select({ id: offices.id, name: offices.name }).from(ndas).innerJoin(offices, eq(offices.id, ndas.officeId)).where(eq(ndas.dealId, id));
  const [docs, qs, cs] = await Promise.all([
    db.select().from(documents).where(eq(documents.dealId, id)).orderBy(asc(documents.sort), asc(documents.id)),
    db.select().from(questions).where(eq(questions.dealId, id)).orderBy(desc(questions.askedAt)),
    db.select().from(calls).where(eq(calls.dealId, id)).orderBy(desc(calls.createdAt)),
  ]);
  const r = d.room;
  const artKey = Object.entries(ART as Record<string, string>).find(([, v]) => v === d.art)?.[0] || "";
  return (
    <>
      <Msg msg={msg} />
      <p className="crumb"><a href="/admin/deals">← All deals</a> · <a href={`/deals/${d.slug}`}>Public overview</a> · <a href={`/room/${d.slug}`}>Room</a></p>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>{d.company}</h1>
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
        <div className="row"><IN name="peLabel" label="P/E trailing · forward" value={d.peLabel} /><IN name="minTicket" label="Minimum ticket" value={d.minTicket} /></div>
        <div className="row"><label>Card illustration<select name="artKey" defaultValue={artKey}>{Object.keys(ART).map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          <IN name="ndaVersion" label="NDA version" value={d.ndaVersion} hint="Change it when the NDA text changes" /></div>
        <label className="chk"><input type="checkbox" name="published" defaultChecked={d.published} /> Published (shown on the site)</label>
        {!d.published && <label className="chk"><input type="checkbox" name="announce" defaultChecked /> When I publish it, tell every approved office (in the app, and by email once email is set up)</label>}
        <label className="chk"><input type="checkbox" name="open" defaultChecked={d.open} /> Room open (offices can sign the NDA and enter)</label>
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
        <div className="adm-save"><button className="btn primary" type="submit">Save deal</button></div>
      </form>

      <h2 id="docs">Documents</h2>
      <p className="fine">Paste a link to the file (for example a Google Drive file shared with “anyone with the link”, or any secure URL). Offices only reach it through the room, and every view is logged. Status “on request” shows the file exists but is shared only with offices that indicate interest.
        Choose who sees each file: every office that signed this NDA, only offices that requested an allocation (for a draft term sheet, say: others see it listed as opening after their request), or only the offices you pick (hold Ctrl or Cmd to pick several).</p>
      {[...docs, null].map((doc, i) => (
        <form key={doc?.id ?? "new"} action={saveDocument} className="form adm-row">
          <input type="hidden" name="dealId" value={d.id} /><input type="hidden" name="id" value={doc?.id ?? 0} />
          <input name="title" defaultValue={doc?.title} placeholder={doc ? "" : "New document title"} required={!doc} />
          <input name="kind" defaultValue={doc?.kind ?? ""} placeholder="PDF · 48 pp" style={{ maxWidth: 130 }} />
          <select name="status" defaultValue={doc?.status ?? "available"}><option value="available">Available</option><option value="on_request">On request</option><option value="requested">Requested from company</option></select>
          <input name="url" defaultValue={doc?.url ?? ""} placeholder="https://… link to the file" />
          <select name="audience" defaultValue={doc?.audience ?? "nda"} title="Who sees it">
            <option value="nda">All offices with the NDA</option><option value="allocation">Only offices that requested an allocation</option><option value="offices">Only the offices selected</option></select>
          <select name="officeIds" multiple defaultValue={(doc?.officeIds ?? []).map(String)} title="Selected offices (hold Ctrl/Cmd to pick several)" className="adm-multi">
            {signedOffices.length ? signedOffices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>) : <option disabled value="">No office has signed this NDA yet</option>}</select>
          <input name="sort" defaultValue={doc?.sort ?? 100 + i} style={{ maxWidth: 60 }} />
          {doc && <label className="chk"><input type="checkbox" name="delete" /> delete</label>}
          <button className="btn sm" type="submit">{doc ? "Save" : "Add"}</button>
        </form>
      ))}

      <h2 id="qa">Q&amp;A</h2>
      {qs.map((q) => (
        <form key={q.id} action={answerQuestion} className="form adm-card">
          <input type="hidden" name="id" value={q.id} /><input type="hidden" name="back" value={`/admin/deals/${d.id}#qa`} />
          <label>Question{q.officeId ? (q.private ? " (private to the office that asked)" : " (from an office)") : ""}<input name="question" defaultValue={q.question} /></label>
          <div className="row"><label>Answer<textarea name="answer" rows={2} defaultValue={q.answer ?? ""} /></label><label>Answered by<input name="by" defaultValue={q.answeredBy ?? "Promoter"} /></label></div>
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
