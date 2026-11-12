import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { outsideHoldings, watches } from "@/db/schema";
import { IPO_DATA, istToday, phase, fmtDay } from "@/lib/ipo-calendar";
import { STAGE_TEXT, findIssue, lockInEnds, rupees, totals, worth } from "@/lib/outside";

// The Holdings tab: everything an office holds, in one place. What it bought through the desk (from Portfolio), what
// it holds elsewhere (unlisted, added by hand; listed, imported from a broker's file) at its own prices, and the
// companies it follows for IPO news. Private to the office: the desk has no screen that reads any of it.

const pct = (x: number | null) => (x == null ? "" : `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`);
const px = (n: number | null) => (n == null ? "—" : `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);

export async function holdingsData(officeId: number) {
  const db = await getDb();
  const [hs, ws] = await Promise.all([
    db.select().from(outsideHoldings).where(eq(outsideHoldings.officeId, officeId)).orderBy(desc(outsideHoldings.updatedAt)),
    db.select().from(watches).where(eq(watches.officeId, officeId)).orderBy(desc(watches.createdAt)),
  ]);
  return { hs, ws };
}

export function HoldingsPanel({ data, canCommit, desk }: { data: Awaited<ReturnType<typeof holdingsData>>; canCommit: boolean; desk: { cost: number; value: number; count: number } }) {
  const today = istToday();
  const unlisted = data.hs.filter((h) => h.kind !== "listed");
  const listed = data.hs.filter((h) => h.kind === "listed");
  const tu = totals(unlisted), tl = totals(listed);
  const allCost = desk.cost + tu.cost + tl.cost, allValue = desk.value + tu.value + tl.value;
  const imported = listed.find((h) => h.source === "import");
  const issue = (name: string) => findIssue(name, IPO_DATA.entries);
  const names = IPO_DATA.entries.map((e) => e.name);

  const editForm = (h: (typeof data.hs)[number]) => canCommit && (
    <details className="hd-edit"><summary>Edit</summary>
      <form method="post" action="/api/office/outside" encType="multipart/form-data" className="form"><input type="hidden" name="what" value="edit" /><input type="hidden" name="id" value={h.id} /><input type="hidden" name="kind" value={h.kind} />
        <div className="row3"><label>Company<input name="company" defaultValue={h.company} required maxLength={160} /></label><label>Shares<input name="shares" inputMode="decimal" defaultValue={h.shares ?? ""} required /></label><label>Bought at, ₹ a share<input name="costPerShare" inputMode="decimal" defaultValue={h.costPerShare ?? ""} /></label></div>
        <div className="row3"><label>Your value now, ₹ a share<input name="valuePerShare" inputMode="decimal" defaultValue={h.valuePerShare ?? ""} /></label><label>Bought on<input type="date" name="boughtOn" defaultValue={h.boughtOn ?? ""} /></label><label>Bought through<input name="via" defaultValue={h.via ?? ""} maxLength={80} /></label></div>
        <div style={{ display: "flex", gap: 8 }}><button className="btn sm" type="submit">Save</button><button className="btn sm ghost" type="submit" name="what" value="remove" formNoValidate>Remove</button></div>
      </form></details>);

  return (
    <section className="panel" data-panel="Holdings" hidden>
      <div className="panel-head"><div><h2>Everything you hold</h2><p className="fine">What you invested through the desk, what you hold elsewhere and the companies you follow, in one place. Only your office sees this page; the desk does not.</p></div></div>

      <div className="pf-sum">
        <div><span className="k">All holdings</span><b>{rupees(allValue)}</b><small>{allCost ? `${pct((allValue - allCost) / allCost)} on ${rupees(allCost)} invested` : "Add a holding below to start"}</small></div>
        <div><span className="k">Through the desk</span><b>{desk.count ? rupees(desk.value) : "—"}</b><small>{desk.count ? `${desk.count} ${desk.count === 1 ? "holding" : "holdings"} · see Portfolio` : "None yet"}</small></div>
        <div><span className="k">Unlisted, elsewhere</span><b>{unlisted.length ? rupees(tu.value) : "—"}</b><small>{unlisted.length ? `${unlisted.length} · ${pct(tu.change) || "at cost"}${tu.unvalued ? ` · ${tu.unvalued} at cost` : ""}` : "None added"}</small></div>
        <div><span className="k">Listed</span><b>{listed.length ? rupees(tl.value) : "—"}</b><small>{listed.length ? `${listed.length} · ${pct(tl.change) || "at cost"}${imported?.valuedOn ? ` · prices of ${fmtDay(imported.valuedOn)}` : ""}` : "Import from your broker"}</small></div>
      </div>
      <p className="fine">Values are your own: the price you enter, or for an import, the price in your broker&apos;s file on the day you imported it. Where you give none, a holding counts at cost. The desk takes no view on any price.</p>

      <div className="chart hd-block">
        <div className="hd-head"><span className="k">Unlisted and pre-IPO, bought elsewhere</span></div>
        {unlisted.length ? <div className="cmpwrap"><table className="cmp plain hd-table"><thead><tr><th>Company</th><th>Shares</th><th>Bought at</th><th>Your value</th><th>Value</th><th>IPO</th><th /></tr></thead><tbody>
          {unlisted.map((h) => { const w = worth(h), i = issue(h.company), p = i ? phase(i, today) : null, lock = i ? lockInEnds(i) : null; return (
            <tr key={h.id}><th scope="row">{h.company}<br /><small className="fine">{[h.via, h.boughtOn && `bought ${fmtDay(h.boughtOn)}`].filter(Boolean).join(" · ")}</small></th>
              <td>{h.shares?.toLocaleString("en-IN")}</td><td>{px(h.costPerShare)}</td>
              <td>{px(h.valuePerShare)}{h.valuedOn ? <><br /><small className="fine">{fmtDay(h.valuedOn)}</small></> : null}</td>
              <td>{rupees(w.value)}{w.change != null ? <><br /><small className={w.change >= 0 ? "up" : "down"}>{pct(w.change)}</small></> : null}</td>
              <td>{i && p ? <><span className={`pill ${p === "open" ? "ok" : p === "listed" ? "" : "mid"}`}>{STAGE_TEXT[p]}</span><br /><small className="fine">{p === "listed" ? (lock ? `Locked in until about ${fmtDay(lock)}` : "") : `${fmtDay(i.open)} to ${fmtDay(i.close)}${i.band ? ` · ${i.band}` : ""}`}</small></> : <small className="fine">No IPO yet · you will be told</small>}</td>
              <td>{editForm(h)}</td></tr>); })}
        </tbody></table></div> : <p className="fine">Shares in unlisted companies you bought elsewhere: from a platform, a round, an employer. Add them and see them beside your desk holdings, with IPO news as it comes.</p>}
        {canCommit && <details className="hd-add" open={!unlisted.length}><summary className="btn sm">+ Add an unlisted holding</summary>
          <form method="post" action="/api/office/outside" encType="multipart/form-data" className="form"><input type="hidden" name="what" value="add" /><input type="hidden" name="kind" value="unlisted" />
            <div className="row3"><label>Company<input name="company" required maxLength={160} list="ipo-names" placeholder="e.g. Acme Industries Ltd" /></label><label>Shares<input name="shares" inputMode="decimal" required /></label><label>Bought at, ₹ a share<input name="costPerShare" inputMode="decimal" /></label></div>
            <div className="row3"><label>Your value now, ₹ a share (optional)<input name="valuePerShare" inputMode="decimal" placeholder="e.g. the last round's price" /></label><label>Bought on<input type="date" name="boughtOn" /></label><label>Bought through (optional)<input name="via" maxLength={80} placeholder="e.g. a platform, a broker, a round" /></label></div>
            <div><button className="btn primary sm" type="submit">Add</button></div></form></details>}
      </div>

      <div className="chart hd-block">
        <div className="hd-head"><span className="k">Listed shares</span>{imported && <small className="fine">Imported {fmtDay(imported.createdAt.toISOString().slice(0, 10))}{imported.via ? ` from ${imported.via}` : ""}</small>}</div>
        {listed.length > 0 && <div className="cmpwrap"><table className="cmp plain hd-table"><thead><tr><th>Company</th><th>Shares</th><th>Avg. cost</th><th>Price</th><th>Value</th><th /></tr></thead><tbody>
          {listed.sort((a, b) => worth(b).value - worth(a).value).map((h) => { const w = worth(h); return (
            <tr key={h.id}><th scope="row">{h.company}{h.symbol && h.symbol !== h.company ? <><br /><small className="fine">{h.symbol}</small></> : null}</th>
              <td>{h.shares?.toLocaleString("en-IN")}</td><td>{px(h.costPerShare)}</td><td>{px(h.valuePerShare)}</td>
              <td>{rupees(w.value)}{w.change != null ? <><br /><small className={w.change >= 0 ? "up" : "down"}>{pct(w.change)}</small></> : null}</td><td>{h.source === "manual" && editForm(h)}</td></tr>); })}
        </tbody></table></div>}
        {canCommit ? <form method="post" action="/api/office/outside" encType="multipart/form-data" className="form hd-import"><input type="hidden" name="what" value="import" />
          <div className="row"><label>{imported ? "Import a newer holdings file" : "Your broker's holdings file"} (.xlsx or .csv)<input type="file" name="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /></label>
            <label>Broker (optional)<input name="via" maxLength={80} placeholder="e.g. Zerodha, PESB" /></label></div>
          <div><button className="btn sm" type="submit">Import</button></div>
          <p className="fine">Download the holdings report from your broker&apos;s console (Zerodha Console, ICICIdirect, HDFC Securities and most others export one) and upload it as it is. Names, quantities, average cost and the day&apos;s price are read from it; nothing else is kept. A new import replaces the last one.</p></form>
          : !listed.length && <p className="fine">Your office&apos;s principal can import listed holdings from a broker&apos;s file.</p>}
      </div>

      <div className="chart hd-block" id="follow">
        <div className="hd-head"><span className="k">Companies you follow</span></div>
        <p className="fine">You are told when a company you follow announces its IPO dates, opens, closes and lists. Unlisted companies you hold are followed already.</p>
        {data.ws.length > 0 && <ul className="hd-watch">{data.ws.map((w) => { const i = issue(w.name), p = i ? phase(i, today) : null; return (
          <li key={w.id}><b>{w.name}</b>{i && p ? <span className={`pill ${p === "open" ? "ok" : "mid"}`}>{STAGE_TEXT[p]}</span> : <span className="fine">No IPO dates yet</span>}
            {i && p && p !== "listed" ? <small className="fine">{fmtDay(i.open)} to {fmtDay(i.close)}{i.band ? ` · ${i.band}` : ""}{i.exchange ? ` · ${i.exchange}` : ""}</small> : i?.listing ? <small className="fine">Listed {fmtDay(i.listing)}</small> : null}
            <form method="post" action="/api/office/watch"><input type="hidden" name="what" value="remove" /><input type="hidden" name="id" value={w.id} /><button className="btn sm ghost" type="submit" aria-label={`Stop following ${w.name}`}>×</button></form></li>); })}</ul>}
        <form method="post" action="/api/office/watch" className="form hd-follow"><input type="hidden" name="what" value="add" />
          <div className="row"><label>Company<input name="name" required maxLength={120} list="ipo-names" placeholder="Any company, listed soon or not" /></label><div style={{ alignSelf: "end" }}><button className="btn sm" type="submit">Follow</button></div></div></form>
        <datalist id="ipo-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        <p className="fine">IPO dates come from the public IPO calendar, updated each week. See <a href="/ipo-calendar">the IPO calendar</a> for every issue.</p>
      </div>
    </section>
  );
}
