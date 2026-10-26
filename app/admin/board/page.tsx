// The deal pipeline: every deal on the desk (pre-IPO and listed) by the desk's own stage. Desk only.
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeals, deskMembers, listTasks } from "@/lib/desk";
import { setDealStage } from "@/lib/desk-actions";
import { DEAL_STAGES } from "@/lib/stages";
import { Msg } from "@/components/AdminBits";
import { fmtT } from "@/components/DeskBits";

export const dynamic = "force-dynamic";

export default async function Board({ searchParams }: { searchParams: Promise<{ msg?: string; who?: string; kind?: string; view?: string }> }) {
  const me = await requireDesk();
  const { msg, who, kind, view } = await searchParams;
  const board = view === "board";
  const [all, members, open] = await Promise.all([deskDeals(), deskMembers(), listTasks({ status: "open", me })]);
  const ownerFilter = who === "me" ? me.id : who === "none" ? null : who ? Number(who) : undefined;
  const list = all.filter((d) => (ownerFilter === undefined || d.ownerId === ownerFilter) && (!kind || (kind === "listed" ? d.listed : !d.listed)));
  const name = new Map(members.map((m) => [m.id, m.name]));
  const work = can(me, "workflow");
  const q = (k: string, v: string) => { const p = new URLSearchParams(); if (who) p.set("who", who); if (kind) p.set("kind", kind); if (board) p.set("view", "board"); if (v) p.set(k, v); else p.delete(k); const s = p.toString(); return `/admin/board${s ? `?${s}` : ""}`; };
  const back = q("x", "");
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 4px" }}>Deal pipeline</h1>
      <p className="fine" style={{ marginBottom: 10 }}>Every deal by the desk&apos;s own stage. Moving a card changes nothing on the site: publishing and opening a room stay in the deal itself.</p>
      <div className="adm-filter">{[["", "Everyone"], ["me", "Mine"], ["none", "No owner"], ...members.filter((m) => m.id !== me.id).map((m) => [String(m.id), m.name])].map(([k, l]) =>
        <a key={`w${k}`} href={q("who", k)} className={(who || "") === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter">{[["", "All deals"], ["private", "Pre-IPO and unlisted"], ["listed", "After the Bell (listed)"]].map(([k, l]) =>
        <a key={`k${k}`} href={q("kind", k)} className={(kind || "") === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter">{[["", "Sections"], ["board", "Board"]].map(([k, l]) =>
        <a key={`v${k}`} href={q("view", k)} className={(view || "") === k ? "on" : ""}>{l}</a>)}</div>
      {!board && <div className="pl-sections">
        {DEAL_STAGES.map((s) => { const cs = list.filter((d) => d.pipelineStage === s.id); return (
          <section key={s.id} className={`pl-sec pl-${s.id}${cs.length ? "" : " empty"}`} aria-label={s.label}>
            <h2>{s.label} <em>{cs.length}</em>{!cs.length && <small className="fine"> · {s.hint}</small>}</h2>
            {cs.length > 0 && <div className="cmpwrap"><table className="cmp plain pl-table"><thead><tr><th>Deal</th><th>Type</th><th>Owner</th><th>Open tasks</th><th>In this stage since</th>{work && <th>Move to</th>}</tr></thead>
              <tbody>{cs.map((d) => { const t = open.filter((x) => x.dealId === d.id).length; return (
                <tr key={d.id}>
                  <th scope="row"><a href={d.listed ? `/admin/after-the-bell/${d.id}` : `/admin/deals/${d.id}`}>{d.company}</a><br />{d.listed ? <span className="pill">Listed · desk only</span> : d.published ? <span className="pill ok">On the site</span> : <span className="pill">Desk only</span>}</th>
                  <td>{d.listed ? [d.listedInfo?.dealType, d.listedInfo?.ticker].filter(Boolean).join(" · ") || "Listed company" : d.category}</td>
                  <td>{d.ownerId ? name.get(d.ownerId) ?? "—" : <span className="fine">No owner</span>}</td>
                  <td>{t ? <a href={d.listed ? `/admin/after-the-bell/${d.id}` : `/admin/deals/${d.id}`}>{t}</a> : "—"}</td>
                  <td>{d.stageAt ? fmtT(d.stageAt) : "—"}</td>
                  {work && <td><form action={setDealStage} className="inline deal-move"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
                    <label className="sr-only" htmlFor={`ss${d.id}`}>Stage for {d.company}</label>
                    <select id={`ss${d.id}`} name="stage" defaultValue={d.pipelineStage}>{DEAL_STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                    <button className="btn sm" type="submit">Move</button></form></td>}
                </tr>); })}</tbody></table></div>}
          </section>); })}
      </div>}
      {board && <div className="pl-board deal-board">
        {DEAL_STAGES.map((s) => { const cs = list.filter((d) => d.pipelineStage === s.id); return (
          <section key={s.id} className={`pl-col pl-${s.id}`} aria-label={s.label}>
            <header><b>{s.label}</b><em>{cs.length}</em></header>
            <ul>{cs.length ? cs.map((d) => { const t = open.filter((x) => x.dealId === d.id).length; return (
              <li key={d.id} className="pl-card">
                <div className="pl-top"><a href={d.listed ? `/admin/after-the-bell/${d.id}` : `/admin/deals/${d.id}`}><b>{d.company}</b></a>{d.listed ? <span className="pill">Listed</span> : d.published ? <span className="pill ok">On the site</span> : <span className="pill">Desk only</span>}</div>
                <small className="fine">{d.listed ? [d.listedInfo?.dealType, d.listedInfo?.ticker].filter(Boolean).join(" · ") || "Listed company" : d.category}</small>
                <small className="fine">{d.ownerId ? name.get(d.ownerId) ?? "—" : "No owner"}{t ? ` · ${t} open task${t === 1 ? "" : "s"}` : ""}{d.stageAt ? ` · since ${fmtT(d.stageAt)}` : ""}</small>
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
