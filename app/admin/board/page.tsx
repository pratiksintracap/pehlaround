// The deal pipeline: every deal on the desk (pre-IPO, listed and debt) by the desk's own stage. Desk only.
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeals, deskMembers, listTasks } from "@/lib/desk";
import { setDealStage } from "@/lib/desk-actions";
import { ACTIVE_STAGES, DEAL_STAGES, dealHref } from "@/lib/stages";
import { fmtT } from "@/components/DeskBits";
import { interestFor, isWarm, who as interestWho } from "@/lib/deal-interest";

export const dynamic = "force-dynamic";

export default async function Board({ searchParams }: { searchParams: Promise<{ who?: string; kind?: string; view?: string; s?: string }> }) {
  const me = await requireDesk();
  const { who, kind, view, s: find = "" } = await searchParams;
  const terms = find.toLowerCase().split(/\s+/).filter(Boolean);
  // Search: every word must appear somewhere in the deal's name, sector, type, headline, listing or debt terms.
  const hay = (d: (typeof all)[number]) => [d.company, d.title, d.category, d.headline, d.listingLabel, d.preMoney, JSON.stringify(d.debtInfo ?? {})].join(" ").toLowerCase();
  const board = view === "board";
  const [all, members, open] = await Promise.all([deskDeals(), deskMembers(), listTasks({ status: "open", me })]);
  const interest = await interestFor(all.map((d) => d.id));
  // Who is warm on a deal: interested or further, not passed. Names first, then a count of the rest.
  const warmLine = (id: number) => { const l = (interest.get(id) ?? []).filter((x) => isWarm(x.status)); const pitched = (interest.get(id) ?? []).filter((x) => x.status === "pitched").length;
    return l.length ? `${l.slice(0, 3).map(interestWho).join(", ")}${l.length > 3 ? ` +${l.length - 3}` : ""}` : pitched ? `${pitched} pitched, none warm yet` : ""; };
  const ownerFilter = who === "me" ? me.id : who === "none" ? null : who ? Number(who) : undefined;
  const list = all.filter((d) => (ownerFilter === undefined || d.ownerId === ownerFilter) && (!kind || (kind === "listed" ? d.listed : kind === "debt" ? d.debt : !d.listed && !d.debt)) && terms.every((t) => hay(d).includes(t)));
  const name = new Map(members.map((m) => [m.id, m.name]));
  const work = can(me, "workflow");
  const q = (k: string, v: string) => { const p = new URLSearchParams(); if (who) p.set("who", who); if (kind) p.set("kind", kind); if (board) p.set("view", "board"); if (find) p.set("s", find); if (v) p.set(k, v); else p.delete(k); const s = p.toString(); return `/admin/board${s ? `?${s}` : ""}`; };
  const back = q("x", "");
  const archivedN = list.filter((d) => d.pipelineStage === "archived").length;
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 4px" }}>Deal pipeline</h1>
      <p className="fine" style={{ marginBottom: 10 }}>Every deal by the desk&apos;s own stage. Moving a card changes nothing on the site: publishing and opening a room stay in the deal itself.{archivedN ? <> <a href="/admin/deals#archived">Archived ({archivedN})</a> are kept on the Deals page.</> : null}</p>
      <form action="/admin/board" className="adm-filter" role="search" style={{ alignItems: "center" }}>
        {who && <input type="hidden" name="who" value={who} />}{kind && <input type="hidden" name="kind" value={kind} />}{board && <input type="hidden" name="view" value="board" />}
        <input type="search" name="s" defaultValue={find} placeholder="Search deals: name, sector, lender, terms…" aria-label="Search deals" style={{ flex: "1 1 260px", maxWidth: 420 }} />
        <button className="btn sm" type="submit">Search</button>
        {find && <><span className="fine">{list.length} match{list.length === 1 ? "" : "es"} for “{find}”</span> <a href={q("s", "")}>Clear</a></>}
      </form>
      <div className="adm-filter">{[["", "Everyone"], ["me", "Mine"], ["none", "No owner"], ...members.filter((m) => m.id !== me.id).map((m) => [String(m.id), m.name])].map(([k, l]) =>
        <a key={`w${k}`} href={q("who", k)} className={(who || "") === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter">{[["", "All deals"], ["private", "Before the Bell (pre-IPO)"], ["listed", "After the Bell (listed)"], ["debt", "Debt desk (lending)"]].map(([k, l]) =>
        <a key={`k${k}`} href={q("kind", k)} className={(kind || "") === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter" style={{ alignItems: "center" }}>{[["", "Sections"], ["board", "Board"]].map(([k, l]) =>
        <a key={`v${k}`} href={q("view", k)} className={(view || "") === k ? "on" : ""}>{l}</a>)}
        <a href={`/admin/board/export${(() => { const p = new URLSearchParams(); if (who) p.set("who", who); if (kind) p.set("kind", kind); if (find) p.set("s", find); const x = p.toString(); return x ? `?${x}` : ""; })()}`} className="btn sm" style={{ marginLeft: "auto" }} download>Export to Excel</a>
        <a href={`/admin/board/export${(() => { const p = new URLSearchParams(); if (who) p.set("who", who); if (kind) p.set("kind", kind); if (find) p.set("s", find); p.set("format", "pdf"); const x = p.toString(); return x ? `?${x}` : ""; })()}`} className="btn sm" download>Export PDF</a></div>
      {!board && <div className="pl-sections">
        {ACTIVE_STAGES.map((s) => { const cs = list.filter((d) => d.pipelineStage === s.id); return (
          <section key={s.id} className={`pl-sec pl-${s.id}${cs.length ? "" : " empty"}`} aria-label={s.label}>
            <h2>{s.label} <em>{cs.length}</em>{!cs.length && <small className="fine"> · {s.hint}</small>}</h2>
            {cs.length > 0 && <div className="cmpwrap"><table className="cmp plain pl-table"><thead><tr><th>Deal</th><th>Type</th><th>Owner</th><th>Interest</th><th>Open tasks</th><th>In this stage since</th>{work && <th>Move to</th>}</tr></thead>
              <tbody>{cs.map((d) => { const t = open.filter((x) => x.dealId === d.id).length; return (
                <tr key={d.id}>
                  <th scope="row"><a href={dealHref(d)}>{d.company}</a><br />{d.listed ? <span className="pill">Listed · desk only</span> : d.debt ? <span className="pill">Debt · desk only</span> : d.published ? <span className="pill ok">On the site</span> : <span className="pill">Desk only</span>}</th>
                  <td>{d.listed ? [d.listedInfo?.dealType, d.listedInfo?.ticker].filter(Boolean).join(" · ") || "Listed company" : d.debt ? [d.debtInfo?.facility, d.debtInfo?.amountCr ? `₹${d.debtInfo.amountCr} Cr` : ""].filter(Boolean).join(" · ") || "Debt" : d.category}</td>
                  <td>{d.ownerId ? name.get(d.ownerId) ?? "—" : <span className="fine">No owner</span>}</td>
                  <td className="fine" style={{ maxWidth: 260 }}>{warmLine(d.id) ? <a href={`${dealHref(d)}#desk-interest`}>{warmLine(d.id)}</a> : "—"}</td>
                  <td>{t ? <a href={dealHref(d)}>{t}</a> : "—"}</td>
                  <td>{d.stageAt ? fmtT(d.stageAt) : "—"}</td>
                  {work && <td><form action={setDealStage} className="inline deal-move"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
                    <label className="sr-only" htmlFor={`ss${d.id}`}>Stage for {d.company}</label>
                    <select id={`ss${d.id}`} name="stage" defaultValue={d.pipelineStage}>{DEAL_STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                    <button className="btn sm" type="submit">Move</button></form></td>}
                </tr>); })}</tbody></table></div>}
          </section>); })}
      </div>}
      {board && <div className="pl-board deal-board">
        {ACTIVE_STAGES.map((s) => { const cs = list.filter((d) => d.pipelineStage === s.id); return (
          <section key={s.id} className={`pl-col pl-${s.id}`} aria-label={s.label}>
            <header><b>{s.label}</b><em>{cs.length}</em></header>
            <ul>{cs.length ? cs.map((d) => { const t = open.filter((x) => x.dealId === d.id).length; return (
              <li key={d.id} className="pl-card">
                <div className="pl-top"><a href={dealHref(d)}><b>{d.company}</b></a>{d.listed ? <span className="pill">Listed</span> : d.debt ? <span className="pill">Debt</span> : d.published ? <span className="pill ok">On the site</span> : <span className="pill">Desk only</span>}</div>
                <small className="fine">{d.listed ? [d.listedInfo?.dealType, d.listedInfo?.ticker].filter(Boolean).join(" · ") || "Listed company" : d.debt ? [d.debtInfo?.facility, d.debtInfo?.amountCr ? `₹${d.debtInfo.amountCr} Cr` : ""].filter(Boolean).join(" · ") || "Debt" : d.category}</small>
                <small className="fine">{d.ownerId ? name.get(d.ownerId) ?? "—" : "No owner"}{t ? ` · ${t} open task${t === 1 ? "" : "s"}` : ""}{d.stageAt ? ` · since ${fmtT(d.stageAt)}` : ""}</small>
                {warmLine(d.id) && <small className="fine">Interest: {warmLine(d.id)}</small>}
                {work && <form action={setDealStage} className="inline deal-move"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
                  <label className="sr-only" htmlFor={`st${d.id}`}>Stage for {d.company}</label>
                  <select id={`st${d.id}`} name="stage" defaultValue={d.pipelineStage}>{DEAL_STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                  <button className="btn sm" type="submit">Move</button></form>}
              </li>); }) : <li className="pl-empty">{s.hint}</li>}</ul>
          </section>); })}
      </div>}
    </>
  );
}
