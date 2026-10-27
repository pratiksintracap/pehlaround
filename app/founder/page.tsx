import type { Metadata } from "next";
import { founderContext, founderStats, founderQuestions, founderDocuments } from "@/lib/founder";
import { draftAnswer, suggestDocument, messageDesk } from "@/lib/founder-actions";
import { STEPS, fmtDay } from "@/lib/portfolio";

export const metadata: Metadata = { title: "Founder portal", robots: { index: false } };
const fmtD = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "");
const DOC_STATE: Record<string, [string, string]> = { available: ["In the room", "ok"], on_request: ["Shared on request", "mid"], requested: ["Requested from you", "mid"], proposed: ["With the desk", ""] };

export default async function Founder({ searchParams }: { searchParams: Promise<{ msg?: string; deal?: string }> }) {
  const { msg, deal: want } = await searchParams;
  const { user, deal: d, preview } = await founderContext(want);
  const [st, qs, docs] = await Promise.all([founderStats(d), founderQuestions(d.id), founderDocuments(d.id)]);
  const open = qs.filter((q) => !q.answer), answered = qs.filter((q) => q.answer);
  const maxW = Math.max(1, ...st.weekly);
  const live = d.phase === "closed" ? "Round closed · updates continue for holders" : d.published ? (d.open ? "Live on the desk · room open" : "Live on the desk · room not yet open") : "Being prepared by the desk";
  const tiles: [string, string | number, string][] = [
    ["Overview views", st.views30, "last 30 days"],
    ["Offices that looked", st.offViewed, "since the overview went live"],
    ["NDAs signed", st.ndaAll, st.nda30 ? `${st.nda30} in the last 30 days` : "none in the last 30 days"],
    ["Offices active this week", st.active7, "in the data room, last 7 days"],
    ["Document opens", st.docOpens, `by ${st.docOffices} ${st.docOffices === 1 ? "office" : "offices"}`],
    ["Questions", st.qAll, `${st.qAnswered} answered`],
    ["Calls requested", st.callN, "with you or the desk"],
    ["Offices asking for an allocation", st.indicatedOffices, st.demand ? `₹${+st.demand.total.toFixed(2)} Cr indicated${st.demand.target ? ` of ₹${st.demand.target} Cr` : ""}` : "amounts stay with the desk"],
  ];
  const reached = STEPS.map((s) => !!d.ipo[s.key]), last = reached.lastIndexOf(true);
  return (
    <main className="fp"><div className="wrap">
      {preview && <p className="notice fp-preview"><b>Desk preview.</b> This is what {d.company}&apos;s promoters see. Office names and amounts per office never appear here. <a href={`/admin/deals/${d.id}#promoters`}>Back to the deal</a></p>}
      {msg && <p className="notice" role="status">{msg}</p>}
      <header className="fp-head">
        <div><span className="eyebrow">Founder portal{preview ? "" : ` · ${user.name}`}</span>
          <h1 className="tt">{d.company}<span className="tt2">How your round is going.</span></h1>
          <p className="fine">{live} · target listing {d.listingLabel}{d.listingNote ? `, ${d.listingNote}` : ""}. Offices are never named here; the desk handles every conversation with them.</p></div>
      </header>

      <section className="fp-tiles" aria-label="Activity">{tiles.map(([k, v, sub]) => <div key={k}><span className="k">{k}</span><b>{v}</b><small>{sub}</small></div>)}</section>

      <div className="two fp-two">
        <section className="chart"><span className="k">NDAs signed, week by week</span>
          <div className="fp-bars" role="img" aria-label={`NDAs signed in each of the last eight weeks: ${st.weekly.join(", ")}`}>{st.weekly.map((w, i) => <div key={i}><i style={{ height: `${(w / maxW) * 100}%` }} /><small>{w || ""}</small></div>)}</div>
          <small className="fine">Last eight weeks, oldest on the left.</small></section>
        <section className="chart"><span className="k">Why offices passed</span>
          {st.reasons.length ? <ul className="fp-reasons">{st.reasons.map(([r, n]) => <li key={r}><span>{r}</span><b>{n}</b></li>)}</ul> : <p className="fine">No office has passed so far.</p>}
          <small className="fine">Reasons offices chose when they passed, without names.</small></section>
      </div>

      <section className="chart fp-sec" id="qa"><span className="k">Questions from offices · {open.length} open</span>
        <p className="fine">Draft an answer and the desk posts it to the room, usually the same day. Private questions are answered only to the office that asked.</p>
        {open.length ? open.map((q) => (
          <form key={q.id} action={draftAnswer} className="form fp-q"><input type="hidden" name="id" value={q.id} />
            <p className="fp-qt"><b>{q.question}</b><small>{fmtD(q.askedAt)}{q.private ? " · asked privately" : ""}{q.draftAnswer ? ` · your draft is with the desk (${fmtD(q.draftAt)})` : ""}</small></p>
            <label className="sr">Your answer<textarea name="answer" rows={3} defaultValue={q.draftAnswer ?? ""} maxLength={4000} placeholder="Your answer, as you would say it to an investor" disabled={preview} /></label>
            {!preview && <div><button className="btn sm primary" type="submit">{q.draftAnswer ? "Update the draft" : "Send to the desk"}</button></div>}
          </form>)) : <p className="fine">No open questions.</p>}
        {answered.length > 0 && <details className="fp-ans"><summary>{answered.length} answered</summary><ul>{answered.map((q) => <li key={q.id}><b>{q.question}</b><span>{q.answer}</span></li>)}</ul></details>}
      </section>

      <section className="chart fp-sec" id="docs"><span className="k">Data room</span>
        <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Document</th><th>Status</th><th>Offices that opened it</th></tr></thead><tbody>
          {docs.length ? docs.map((x) => <tr key={x.id}><td>{x.title}{x.kind ? <small className="fine"> · {x.kind}</small> : null}</td><td><span className={`pill ${DOC_STATE[x.status]?.[1] ?? ""}`}>{DOC_STATE[x.status]?.[0] ?? x.status}</span></td><td>{x.status === "proposed" ? "—" : x.offices}</td></tr>)
            : <tr><td colSpan={3} className="fine">No documents yet.</td></tr>}
        </tbody></table></div>
        {!preview && <form action={suggestDocument} className="form fp-doc">
          <b>Add a document</b><p className="fine">Share a secure link (for example a Google Drive file). The desk checks it and decides who in the room sees it.</p>
          <div className="row3"><label>Title<input name="title" required maxLength={300} placeholder="FY26 audited financials" /></label><label>Link<input name="url" type="url" required placeholder="https://…" /></label><label>Type (optional)<input name="kind" maxLength={80} placeholder="PDF · 40 pp" /></label></div>
          <label>Note to the desk (optional)<input name="note" maxLength={500} /></label>
          <div><button className="btn sm primary" type="submit">Send to the desk</button></div></form>}
      </section>

      <section className="chart fp-sec"><span className="k">Road to listing</span>
        <ol className="pf-road">{STEPS.map((s, k) => <li key={s.key} className={reached[k] ? "done" : k === last + 1 ? "now" : ""}><i aria-hidden="true" /><b>{s.label}</b><small>{d.ipo[s.key] ? fmtDay(new Date(String(d.ipo[s.key]) + "T00:00:00+05:30")) : k === last + 1 ? "Next" : ""}</small></li>)}</ol>
        <small className="fine">The desk keeps this up to date; offices that hold shares see the same steps.</small>
      </section>

      {!preview && <section className="chart fp-sec" id="desk"><span className="k">Talk to the desk</span>
        <form action={messageDesk} className="form"><label className="sr">Message<textarea name="message" rows={3} maxLength={2000} placeholder="A change in numbers, a new order, a question about the round…" /></label>
          <div><button className="btn sm primary" type="submit">Send</button></div></form></section>}
    </div></main>
  );
}
