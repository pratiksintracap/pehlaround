import { requireDesk } from "@/lib/auth";
import { listDeals } from "@/lib/deals";
import { pipeline, STAGES, type Card } from "@/lib/pipeline";
import { saveInterest } from "@/lib/admin-actions";
import { can } from "@/lib/perm";
import { Msg } from "@/components/AdminBits";

const fmtD = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) : "—");
const cr = (v: number) => `₹${+v.toFixed(2)} Cr`;
const ago = (d: Date | null) => {
  if (!d) return "";
  const h = (Date.now() - +new Date(d)) / 36e5;
  return h < 1 ? "within the hour" : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
};

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ deal?: string; msg?: string }> }) {
  const me = await requireDesk();
  const { deal: want, msg } = await searchParams;
  const deals = await listDeals(true);
  const d = deals.find((x) => x.slug === want || String(x.id) === want) ?? deals.find((x) => x.published && x.open) ?? deals[0];
  if (!d) return <p>No deals yet.</p>;
  const { cards, book, coverage } = await pipeline(d);
  const edit = can(me, "allocations.confirm");
  const back = `/admin/pipeline?deal=${d.slug}`;
  const pct = (v: number) => (book.target ? Math.min(100, (v / book.target) * 100) : 0);
  const col = (id: string) => cards.filter((c) => c.stage === id);
  const CardView = ({ c }: { c: Card }) => (
    <li className="pl-card">
      <div className="pl-top"><b>{c.office}</b>{c.amountCr !== null && <span className="pl-amt">{cr(c.amountCr)}</span>}</div>
      <small className="fine">since {fmtD(c.since)}{c.last ? ` · seen ${ago(c.last)}` : ""}{c.colead ? " · co-lead" : ""}</small>
      {(c.questions > 0 || c.calls > 0) && <small className="fine">{c.questions ? `${c.questions} question${c.questions === 1 ? "" : "s"}` : ""}{c.questions && c.calls ? " · " : ""}{c.calls ? `${c.calls} call${c.calls === 1 ? "" : "s"}` : ""}</small>}
      {c.reason && <small className="pl-reason">“{c.reason}”</small>}
      {c.stage === "allotted" && (c.shares || c.price) ? <small className="fine">{c.shares ? `${c.shares.toLocaleString("en-IN")} shares` : ""}{c.price ? ` at ₹${c.price}` : ""}</small> : null}
      {c.note && <small className="fine">Note: {c.note}</small>}
      {edit && c.interestId && (
        <details className="pl-edit"><summary>Update</summary>
          <form action={saveInterest} className="form"><input type="hidden" name="id" value={c.interestId} /><input type="hidden" name="back" value={back} />
            <label>Stage<select name="status" defaultValue={c.status ?? "Indicated"}>{["Indicated", "Term sheet", "Documents", "Allotted", "Withdrawn"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <div className="row"><label>Shares allotted<input name="shares" inputMode="numeric" defaultValue={c.shares ?? ""} /></label><label>₹ per share<input name="price" inputMode="decimal" defaultValue={c.price ?? ""} /></label></div>
            <label>Note to the office<input name="note" defaultValue={c.note ?? ""} maxLength={1000} /></label>
            <button className="btn sm primary" type="submit">Save and tell the office</button></form></details>)}
      <a className="pl-link" href={`/admin/log?office=${c.officeId}`}>Activity</a>
    </li>
  );
  return (
    <>
      <Msg msg={msg} />
      <div className="pl-head">
        <div><h1 style={{ fontSize: 30, margin: "6px 0 4px" }}>Pipeline</h1><p className="fine">Every office that has touched the deal, at the furthest stage it has reached. Office names stay on the desk.</p></div>
        <form className="pl-pick" action="/admin/pipeline"><label className="fine">Deal<select name="deal" defaultValue={d.slug}>{deals.map((x) => <option key={x.id} value={x.slug}>{x.company}{x.published ? "" : " (draft)"}</option>)}</select></label><button className="btn sm" type="submit">Show</button></form>
      </div>
      <section className="chart pl-book" aria-label="Allocation book">
        <div className="pl-book-h"><span className="k">Allocation book · {d.company}</span>
          <b>{book.target ? `${cr(book.indicated)} of ${cr(book.target)}` : cr(book.indicated)}{coverage !== null && <em className={coverage >= 1 ? "ok" : ""}> · {Math.round(coverage * 100)}% covered{coverage > 1 ? ", oversubscribed" : ""}</em>}</b></div>
        {book.target ? (
          <div className="pl-bar" role="img" aria-label={`Allotted ${cr(book.allotted)}, term sheet or documents ${cr(book.firm - book.allotted)}, indicated ${cr(book.indicated - book.firm)}, round ${cr(book.target)}`}>
            <i className="a" style={{ width: `${pct(book.allotted)}%` }} /><i className="f" style={{ width: `${pct(book.firm) - pct(book.allotted)}%` }} /><i className="n" style={{ width: `${pct(book.indicated) - pct(book.firm)}%` }} />
          </div>) : <p className="fine">Set the round size in the deal (Round size, ₹ crore) to see coverage.</p>}
        <div className="pl-legend"><span><i className="a" />Allotted {cr(book.allotted)}</span><span><i className="f" />Term sheet or documents {cr(book.firm - book.allotted)}</span><span><i className="n" />Indicated {cr(book.indicated - book.firm)}</span><span>{book.offices} {book.offices === 1 ? "office" : "offices"} asking</span>
          {!edit && <span className="fine">A super admin moves allocations.</span>}</div>
      </section>
      <div className="pl-board">
        {STAGES.map((s) => { const cs = col(s.id); const amt = cs.reduce((t, c) => t + (c.amountCr ?? 0), 0); return (
          <section key={s.id} className={`pl-col pl-${s.id}`} aria-label={s.label}>
            <header><b>{s.label}</b><em>{cs.length}</em>{amt > 0 && <small>{cr(amt)}</small>}</header>
            <ul>{cs.length ? cs.map((c) => <CardView key={c.officeId} c={c} />) : <li className="pl-empty">{s.hint}</li>}</ul>
          </section>); })}
      </div>
    </>
  );
}
