// One debt deal: its terms and the desk workspace (tasks, notes, files). Desk only.
import { Field } from "@/components/ui";
import { notFound, redirect } from "next/navigation";
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeal } from "@/lib/desk";
import { saveDebtDeal } from "@/lib/desk-actions";
import { BORROWER_TYPES, DEBT_FACILITIES, dealHref } from "@/lib/stages";
import { DeskWorkspace } from "@/components/DeskWorkspace";

export const dynamic = "force-dynamic";

const IN = (p: { name: string; label: string; value?: string | number | null; ph?: string; mode?: "decimal" }) => <Field {...p} max={300} />;

export default async function DebtDeal({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDesk();
  const id = Number((await params).id);
  const d = await deskDeal(id);
  if (!d) notFound();
  if (!d.debt) redirect(dealHref(d));
  const i = d.debtInfo || {};
  const edit = can(me, "deals.edit");
  const back = `/admin/debt/${d.id}`;
  return (
    <>
      <p className="crumb"><a href="/admin/debt">← Debt desk</a> · <a href="/admin/board">Deal pipeline</a></p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "6px 0 6px" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>{d.company}</h1><span className="pill">Debt · desk only</span>
        {i.facility ? <span className="mono fine">{[i.facility, i.amountCr ? `₹${i.amountCr} Cr` : ""].filter(Boolean).join(" · ")}</span> : null}<span className="mono fine" title="Internal reference; there is no public page">ref {d.slug}</span></div>
      <p className="fine" style={{ marginBottom: 14 }}>This deal has no public page, room or NDA, and is never shown to investors.</p>
      <DeskWorkspace d={d} me={me} back={back} />
      <div className="chart" style={{ marginTop: 22 }} id="details"><span className="k">Borrower and facility</span>
        <form action={saveDebtDeal} className="form"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
          <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="row"><IN name="company" label="Borrower" value={d.company} /><label>Borrower type<select name="borrowerType" defaultValue={i.borrowerType || "Company"}>{BORROWER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label></div>
          <div className="row"><label>Facility<select name="facility" defaultValue={i.facility || "Term loan"}>{DEBT_FACILITIES.map((t) => <option key={t}>{t}</option>)}</select></label><IN name="sector" label="Sector" value={i.sector} /></div>
          <div className="row"><IN name="amountCr" label="Amount (₹ crore)" value={i.amountCr ?? ""} mode="decimal" /><IN name="tenorMonths" label="Tenor (months)" value={i.tenorMonths ?? ""} mode="decimal" /></div>
          <div className="row"><IN name="rateBand" label="Rate or band" value={i.rateBand} ph="11.5–12.5%" /><IN name="rating" label="Rating" value={i.rating} ph="e.g. BBB+ (CARE), or unrated" /></div>
          <div className="row"><IN name="security" label="Security" value={i.security} /><IN name="purpose" label="Purpose" value={i.purpose} /></div>
          <div className="row"><label>Side<select name="side" defaultValue={i.side || ""}><option value="">—</option><option>Arranging for the borrower</option><option>Placing for a lender</option><option>Both</option></select></label><IN name="lenders" label="Lenders approached" value={i.lenders} ph="Vivriti, SIDBI, …" /></div>
          <div className="row"><IN name="counterparty" label="Counterparty / intermediary" value={i.counterparty} /><IN name="source" label="Source" value={i.source} ph="Who brought it" /></div>
          <IN name="status" label="Status line" value={d.status} />
          <label>Summary<textarea name="summary" rows={4} maxLength={2000} defaultValue={d.headline} /></label>
          {edit && <div><button className="btn primary" type="submit">Save</button></div>}
          </fieldset></form></div>
    </>
  );
}
