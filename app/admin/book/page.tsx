import { requireAdmin } from "@/lib/auth";
import { loadBook, type BookDeal } from "@/lib/deal-book";
import { phaseInfo } from "@/lib/phase";
import { stageLabel } from "@/lib/stages";
import { PrintButton } from "./PrintButton";

// The deal book: page 1 sums up every deal on the desk, then one A4 page per company with its facts, activity and
// what is missing. Super admin only (it names companies and shows desk data). Print it, or save it as a PDF.
export const dynamic = "force-dynamic";

const IST = (d: Date) => d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const cut = (s: string | null | undefined, n: number) => { const t = (s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const val = (v: string | number | null | undefined) => (v == null || v === "" ? <span className="bk-miss">missing</span> : v);
const AUD: Record<string, string> = { approved: "approved investors", nda: "after NDA", allocation: "requesters", offices: "named offices" };

function Summary({ list, at }: { list: BookDeal[]; at: Date }) {
  const pre = list.filter((x) => !x.d.listed), listed = list.filter((x) => x.d.listed);
  const count = (p: string) => pre.filter((x) => x.d.phase === p).length;
  const req = pre.reduce((a, x) => a + x.requestedCr, 0);
  const must = pre.reduce((a, x) => a + x.gaps.filter((g) => g.level === "must").length, 0);
  return (
    <section className="bk-page">
      <header className="bk-top"><div><span className="bk-k">Before the Bell · desk only · confidential</span><h1>Deal book</h1></div>
        <div className="bk-at">As of {IST(at)} IST<br />Operated by SintraCap</div></header>
      <div className="bk-stats">
        <div><b>{pre.length}</b><span>pre-IPO deals</span></div>
        <div><b>{count("open")}</b><span>room open</span></div>
        <div><b>{count("announced") + count("coming")}</b><span>announced / coming</span></div>
        <div><b>{count("preparing")}</b><span>in preparation</span></div>
        <div><b>₹{req.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr</b><span>requested</span></div>
        <div><b className={must ? "bad" : ""}>{must}</b><span>must-fix gaps</span></div>
      </div>
      <table className="bk-t">
        <thead><tr><th>#</th><th>Company</th><th>Structure</th><th>Phase</th><th>Desk stage</th><th>Round</th><th>Pre-money</th><th>Min ticket</th><th>Listing</th><th>Score</th><th>NDAs</th><th>Requested</th><th>Complete</th></tr></thead>
        <tbody>{pre.map((x, i) => (
          <tr key={x.d.id}><td>{i + 2}</td><td><b>{x.d.company}</b><small>{cut(x.d.title, 46)}</small></td><td>{x.d.category}</td><td>{phaseInfo(x.d.phase).label}</td><td>{stageLabel(x.d.pipelineStage)}</td>
            <td>{val(x.d.roundLabel ?? (x.d.roundCr != null ? `₹${x.d.roundCr} Cr` : null))}</td><td>{val(x.d.preMoney)}</td><td>{val(x.d.minTicket)}</td><td>{val(x.d.listingLabel)}</td>
            <td>{x.d.score != null ? x.d.score.toFixed(1) : val(null)}</td><td>{x.ndas}</td><td>{x.requestedCr ? `₹${x.requestedCr.toLocaleString("en-IN")} Cr` : "—"}</td>
            <td><span className={`bk-pct ${x.complete >= 85 ? "ok" : x.complete >= 60 ? "mid" : "bad"}`}>{x.complete}%</span></td></tr>))}</tbody>
      </table>
      {listed.length > 0 && <>
        <h2 className="bk-h2">After the Bell · listed-company deals (desk only)</h2>
        <table className="bk-t"><thead><tr><th>#</th><th>Company</th><th>Ticker</th><th>Type</th><th>Size</th><th>Desk stage</th><th>Owner</th></tr></thead>
          <tbody>{listed.map((x, i) => { const li = x.d.listedInfo ?? {}; return (
            <tr key={x.d.id}><td>{pre.length + i + 2}</td><td><b>{x.d.company}</b></td><td>{val(li.ticker ? `${li.exchange ? li.exchange + ": " : ""}${li.ticker}` : null)}</td><td>{val(li.dealType)}</td>
              <td>{val(li.sizeCr != null ? `₹${li.sizeCr} Cr` : null)}</td><td>{stageLabel(x.d.pipelineStage)}</td><td>{val(x.owner)}</td></tr>); })}</tbody></table></>}
      <p className="bk-fine">Complete = share of the desk&apos;s listing checks a deal passes (round, valuation, ticket, score, listing date, pitch deck, rationale, financials, and the room&apos;s supporting sections). Each company&apos;s page lists what is missing. # is the page number.</p>
    </section>
  );
}

function DealPage({ x, n }: { x: BookDeal; n: number }) {
  const { d } = x, r = d.room ?? ({} as typeof d.room);
  const must = x.gaps.filter((g) => g.level === "must"), should = x.gaps.filter((g) => g.level === "should");
  const fill = r.fill?.committedCr != null && d.roundCr ? `₹${r.fill.committedCr} of ₹${d.roundCr} Cr${r.fill.anchor ? " · anchor in" : ""}` : r.committed || null;
  return (
    <section className="bk-page">
      <header className="bk-dh">
        <div><span className="bk-k">{n} · {d.category}</span><h1>{d.company}</h1><p>{cut(d.title, 90)}</p></div>
        <div className="bk-chips"><span className={`bk-chip ph-${d.phase}`}>{phaseInfo(d.phase).label}</span><span className="bk-chip">Desk: {stageLabel(d.pipelineStage)}</span>
          <span className="bk-chip">Owner: {x.owner ?? "—"}</span><span className={`bk-pct ${x.complete >= 85 ? "ok" : x.complete >= 60 ? "mid" : "bad"}`}>{x.complete}% complete</span></div>
      </header>
      {cut(d.headline, 200) && <p className="bk-lede">{cut(d.headline, 200)}</p>}
      <div className="bk-facts">
        {([["Round", d.roundLabel ?? (d.roundCr != null ? `₹${d.roundCr} Cr` : null)], ["Pre-money", d.preMoney], ["P/E", d.peLabel], ["Min ticket", d.minTicket],
          ["Target listing", d.listingLabel ? `${d.listingLabel}${d.listingNote ? ` · ${d.listingNote}` : ""}` : null], ["Desk Score", d.score != null ? d.score.toFixed(1) : null],
          ["Committed", fill], ["Figures as of", d.asOf]] as [string, string | null][]).map(([k, v]) => <div key={k}><span>{k}</span><b>{val(v)}</b></div>)}
      </div>
      <div className="bk-cols">
        <div>
          <h3>Why it is on the desk</h3><p>{r.why ? cut(r.why, 620) : <span className="bk-miss">missing</span>}</p>
          {(r.snapshot ?? []).length > 0 && <><h3>Snapshot</h3><div className="bk-snap">{r.snapshot.slice(0, 6).map((c) => <div key={c.k}><span>{cut(c.k, 28)}</span><b>{cut(c.v, 22)}</b>{c.s ? <small>{cut(c.s, 34)}</small> : null}</div>)}</div></>}
          {r.founders?.length ? <><h3>Promoters and management</h3><p>{r.founders.slice(0, 5).map((f) => `${f.name} (${f.role})`).join(" · ")}</p></> : null}
        </div>
        <div>
          <h3>Investor activity</h3>
          <ul className="bk-act"><li><b>{x.offices}</b> offices engaged</li><li><b>{x.ndas}</b> NDAs signed</li><li><b>{x.requests}</b> allocation requests{x.requestedCr ? ` · ₹${x.requestedCr.toLocaleString("en-IN")} Cr` : ""}</li><li><b>{x.passes}</b> passes</li></ul>
          <h3>Documents ({x.docs.length})</h3>
          {x.docs.length ? <ul className="bk-docs">{x.docs.slice(0, 7).map((doc, i) => <li key={i}>{cut(doc.title, 44)} <small>{AUD[doc.audience] ?? doc.audience}</small></li>)}{x.docs.length > 7 && <li><small>and {x.docs.length - 7} more</small></li>}</ul> : <p><span className="bk-miss">none</span></p>}
          <p className="bk-small">Data room: {d.dataRoomUrl ? "linked" : <span className="bk-miss">not linked</span>} · Peer comparison: {r.compare ? "saved" : r.compareDraft ? "draft waiting" : <span className="bk-miss">none</span>}</p>
        </div>
      </div>
      {r.fin?.rows?.length ? <><h3>Financials{r.fin.unit ? ` (${r.fin.unit})` : ""}</h3>
        <table className="bk-fin"><thead><tr><th></th>{r.fin.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{r.fin.rows.slice(0, 8).map((row) => <tr key={row.label}><td>{cut(row.label, 30)}</td>{row.vals.map((v, i) => <td key={i}>{v}</td>)}</tr>)}</tbody></table></> : null}
      <div className="bk-cols">
        <div>{(r.risks ?? []).length > 0 && <><h3>Key risks</h3><ul className="bk-list">{r.risks.slice(0, 4).map((k) => <li key={k.t}><b>{cut(k.t, 60)}.</b> {cut(k.d, 130)}</li>)}</ul></>}</div>
        <div>{(r.path ?? []).length > 0 && <><h3>Road to listing</h3><ul className="bk-list">{r.path.slice(0, 5).map((p) => <li key={p.title}><span className={`bk-dot ${p.status}`} />{cut(p.title, 50)}{p.note ? <small> · {cut(p.note, 60)}</small> : null}</li>)}</ul></>}</div>
      </div>
      <div className="bk-gaps">
        <h3>Gaps to close {x.gaps.length ? `(${x.gaps.length})` : ""}</h3>
        {x.gaps.length ? <div className="bk-gl">
          {must.map((g) => <span key={g.what} className="bk-g must">{g.what}</span>)}
          {should.map((g) => <span key={g.what} className="bk-g should">{g.what}</span>)}</div> : <p>Nothing missing.</p>}
      </div>
    </section>
  );
}

function ListedPage({ x, n }: { x: BookDeal; n: number }) {
  const { d } = x, li = d.listedInfo ?? {};
  return (
    <section className="bk-page">
      <header className="bk-dh"><div><span className="bk-k">{n} · After the Bell · listed company · desk only</span><h1>{d.company}</h1><p>{cut(d.title, 90)}</p></div>
        <div className="bk-chips"><span className="bk-chip">Desk: {stageLabel(d.pipelineStage)}</span><span className="bk-chip">Owner: {x.owner ?? "—"}</span></div></header>
      <div className="bk-facts">
        {([["Exchange · ticker", li.ticker ? `${li.exchange ?? ""} ${li.ticker}`.trim() : null], ["ISIN", li.isin], ["Sector", li.sector], ["Deal type", li.dealType], ["Side", li.side],
          ["Size", li.sizeCr != null ? `₹${li.sizeCr} Cr` : null], ["Price", li.price], ["Market cap", li.marketCap]] as [string, string | null | undefined][]).map(([k, v]) => <div key={k}><span>{k}</span><b>{val(v ?? null)}</b></div>)}
      </div>
      {(li.counterparty || li.source) && <p className="bk-small">{li.counterparty ? `Counterparty: ${li.counterparty}. ` : ""}{li.source ? `Source: ${li.source}.` : ""}</p>}
      <div className="bk-gaps"><h3>Gaps to close</h3>{x.gaps.length ? <div className="bk-gl">{x.gaps.map((g) => <span key={g.what} className={`bk-g ${g.level}`}>{g.what}</span>)}</div> : <p>Nothing missing.</p>}</div>
    </section>
  );
}

export default async function DealBook() {
  await requireAdmin();
  const { deals: list, at } = await loadBook();
  const pre = list.filter((x) => !x.d.listed);
  return (
    <div className="bk">
      <div className="bk-bar"><div><b>Deal book</b> · {list.length} deals · one page each. Use Save as PDF in the print dialog (A4, margins none, background graphics on).</div><PrintButton /></div>
      <Summary list={list} at={at} />
      {list.map((x, i) => x.d.listed ? <ListedPage key={x.d.id} x={x} n={i + 2} /> : <DealPage key={x.d.id} x={x} n={i + 2} />)}
      {!pre.length && <p>No deals yet.</p>}
    </div>
  );
}
