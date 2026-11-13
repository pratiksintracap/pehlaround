// Debt deals: loans, NCDs, commercial paper and structured credit the desk arranges (including NBFC-to-NBFC raises).
// Desk only. These deals never reach any investor-facing page, API, email or sitemap (lib/deal-guard.ts).
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeals, deskMembers, listTasks } from "@/lib/desk";
import { createDebtDeal } from "@/lib/desk-actions";
import { BORROWER_TYPES, DEAL_STAGES, DEBT_FACILITIES, stageLabel } from "@/lib/stages";
import { fmtT } from "@/components/DeskBits";

export const dynamic = "force-dynamic";

export default async function DebtDeals({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const me = await requireDesk();
  const { stage } = await searchParams;
  const [all, members, open] = await Promise.all([deskDeals({ kind: "debt" }), deskMembers(), listTasks({ status: "open", me })]);
  const list = all.filter((d) => !stage || (stage === "active" ? d.pipelineStage !== "closed" : d.pipelineStage === stage));
  const who = new Map(members.map((m) => [m.id, m.name]));
  const tasksOn = (id: number) => open.filter((t) => t.dealId === id).length;
  const edit = can(me, "deals.edit");
  const book = all.filter((d) => d.pipelineStage !== "closed" && d.pipelineStage !== "archived").reduce((t, d) => t + (d.debtInfo?.amountCr ?? 0), 0);
  return (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "6px 0 6px" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Debt deals</h1><span className="pill">Desk only</span>
        {edit && <a className="btn sm primary" href="#add">+ Add a debt deal</a>}</div>
      <p className="fine" style={{ marginBottom: 12 }}>Loans, NCDs, commercial paper and structured credit the desk arranges, including NBFC-to-NBFC raises. They live only in the console: no investor page, email or search ever shows them.{book ? <> Open book: <b>₹{book.toLocaleString("en-IN")} Cr</b>.</> : null}</p>
      <div className="adm-filter">{[["", `All (${all.length})`], ["active", "Not closed"], ...DEAL_STAGES.map((s) => [s.id, s.label])].map(([k, l]) =>
        <a key={k} href={k ? `/admin/debt?stage=${k}` : "/admin/debt"} className={(stage || "") === k ? "on" : ""}>{l}</a>)}</div>
      {list.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Borrower</th><th>Facility</th><th>Amount</th><th>Tenor</th><th>Rate</th><th>Stage</th><th>Owner</th><th>Open tasks</th><th>Updated</th><th /></tr></thead><tbody>
        {list.map((d) => { const i = d.debtInfo || {}; return (
          <tr key={d.id}><td className="atb-co"><a href={`/admin/debt/${d.id}`}>{d.company}</a><small className="fine" style={{ display: "block" }}>{[i.borrowerType, i.sector].filter(Boolean).join(" · ")}</small></td>
            <td>{i.facility || "—"}{i.side ? ` · ${i.side}` : ""}</td><td>{i.amountCr ? `₹${i.amountCr} Cr` : "—"}</td><td>{i.tenorMonths ? `${i.tenorMonths} mo` : "—"}</td><td>{i.rateBand || "—"}</td>
            <td><span className={`pill ${d.pipelineStage === "closed" ? "off" : d.pipelineStage === "escrow" || d.pipelineStage === "docs" ? "ok" : ""}`}>{stageLabel(d.pipelineStage)}</span></td>
            <td>{d.ownerId ? who.get(d.ownerId) ?? "—" : "—"}</td><td>{tasksOn(d.id) || "—"}</td><td className="mono">{fmtT(d.updatedAt)}</td>
            <td><a className="btn sm primary" href={`/admin/debt/${d.id}`}>Open</a></td></tr>); })}
      </tbody></table></div> : <p className="fine">{all.length ? "Nothing at this stage." : "No debt deals yet."}</p>}
      {edit && <div className="chart" style={{ marginTop: 22 }} id="add"><span className="k">Add a debt deal</span>
        <form action={createDebtDeal} className="form">
          <div className="row"><label>Borrower<input name="company" required maxLength={200} placeholder="e.g. a Jaipur NBFC, or a company" /></label><label>Borrower type<select name="borrowerType" defaultValue="Company">{BORROWER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label></div>
          <div className="row"><label>Facility<select name="facility" defaultValue="Term loan">{DEBT_FACILITIES.map((t) => <option key={t}>{t}</option>)}</select></label><label>Sector<input name="sector" maxLength={200} placeholder="e.g. Jewellery, Vehicle finance" /></label></div>
          <div className="row"><label>Amount (₹ crore)<input name="amountCr" inputMode="decimal" /></label><label>Tenor (months)<input name="tenorMonths" inputMode="decimal" /></label></div>
          <div className="row"><label>Rate or band<input name="rateBand" maxLength={100} placeholder="e.g. 11.5–12.5%" /></label><label>Security<input name="security" maxLength={300} placeholder="e.g. book debts, shares, property" /></label></div>
          <div className="row"><label>Stage<select name="stage" defaultValue="sourced">{DEAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>Owner<select name="ownerId" defaultValue={me.id}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label></div>
          <label>Summary<textarea name="summary" rows={2} maxLength={600} placeholder="Purpose, who brought it, which lenders it suits" /></label>
          <div><button className="btn primary" type="submit">Add, desk only</button></div></form></div>}
    </>
  );
}
