// After the Bell: companies already listed on an exchange (blocks, bulk deals, preferential allotments, QIPs…).
// Desk only. These deals never reach any investor-facing page, API, email or sitemap (lib/deal-guard.ts).
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeals, deskMembers, listTasks } from "@/lib/desk";
import { createListedDeal } from "@/lib/desk-actions";
import { DEAL_STAGES, LISTED_TYPES, stageLabel } from "@/lib/stages";
import { fmtT } from "@/components/DeskBits";

export const dynamic = "force-dynamic";

export default async function AfterTheBell({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const me = await requireDesk();
  const { stage } = await searchParams;
  const [all, members, open] = await Promise.all([deskDeals({ listed: true }), deskMembers(), listTasks({ status: "open", me })]);
  const list = all.filter((d) => !stage || (stage === "active" ? d.pipelineStage !== "closed" : d.pipelineStage === stage));
  const who = new Map(members.map((m) => [m.id, m.name]));
  const tasksOn = (id: number) => open.filter((t) => t.dealId === id).length;
  const edit = can(me, "deals.edit");
  return (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "6px 0 6px" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>After the Bell</h1><span className="pill">Desk only</span>
        {edit && <a className="btn sm primary" href="#add">+ Add a listed company</a>}</div>
      <p className="fine" style={{ marginBottom: 12 }}>Deals in companies already listed on an exchange. They live only here: no investor, page, search, email, alert or link preview ever shows them, and the database refuses to publish one.</p>
      <div className="adm-filter">{[["", `All (${all.length})`], ["active", "Not closed"], ...DEAL_STAGES.map((s) => [s.id, s.label])].map(([k, l]) =>
        <a key={k} href={k ? `/admin/after-the-bell?stage=${k}` : "/admin/after-the-bell"} className={(stage || "") === k ? "on" : ""}>{l}</a>)}</div>
      {list.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Company</th><th>Exchange · ticker</th><th>Deal</th><th>Size</th><th>Stage</th><th>Owner</th><th>Open tasks</th><th>Updated</th><th /></tr></thead><tbody>
        {list.map((d) => { const i = d.listedInfo || {}; return (
          <tr key={d.id}><td className="atb-co"><a href={`/admin/after-the-bell/${d.id}`}>{d.company}</a>{i.sector ? <small className="fine" style={{ display: "block" }}>{i.sector}</small> : null}</td>
            <td className="mono">{[i.exchange, i.ticker].filter(Boolean).join(": ") || "—"}</td><td>{i.dealType || "—"}{i.side ? ` · ${i.side}` : ""}</td>
            <td>{i.sizeCr ? `₹${i.sizeCr} Cr` : "—"}</td><td><span className={`pill ${d.pipelineStage === "closed" ? "off" : d.pipelineStage === "escrow" || d.pipelineStage === "docs" ? "ok" : ""}`}>{stageLabel(d.pipelineStage)}</span></td>
            <td>{d.ownerId ? who.get(d.ownerId) ?? "—" : "—"}</td><td>{tasksOn(d.id) || "—"}</td><td className="mono">{fmtT(d.updatedAt)}</td>
            <td><a className="btn sm primary" href={`/admin/after-the-bell/${d.id}`}>Open</a></td></tr>); })}
      </tbody></table></div> : <p className="fine">{all.length ? "Nothing at this stage." : "No listed-company deals yet."}</p>}
      {edit && <div className="chart" style={{ marginTop: 22 }} id="add"><span className="k">Add a listed company</span>
        <form action={createListedDeal} className="form">
          <div className="row"><label>Company<input name="company" required maxLength={200} placeholder="e.g. Asian Granito India Ltd" /></label><label>Sector<input name="sector" maxLength={200} placeholder="e.g. Tiles" /></label></div>
          <div className="row"><label>Exchange<select name="exchange" defaultValue="NSE"><option>NSE</option><option>BSE</option><option>NSE and BSE</option><option>NSE SME</option><option>BSE SME</option><option>Other</option></select></label><label>Ticker<input name="ticker" maxLength={40} placeholder="ASIANTILES" /></label></div>
          <div className="row"><label>Deal type<select name="dealType" defaultValue="Block deal">{LISTED_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label><label>Side<select name="side" defaultValue=""><option value="">—</option><option>Buy side</option><option>Sell side</option><option>Both</option></select></label></div>
          <div className="row"><label>Size (₹ crore)<input name="sizeCr" inputMode="decimal" /></label><label>Stage<select name="stage" defaultValue="sourced">{DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div>
          <label>Summary<textarea name="summary" rows={2} maxLength={600} placeholder="What the deal is, who brought it, what is needed" /></label>
          <div className="row"><label>Owner<select name="ownerId" defaultValue={me.id}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><span /></div>
          <div><button className="btn primary" type="submit">Add, desk only</button></div></form></div>}
    </>
  );
}
