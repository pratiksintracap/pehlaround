// One listed-company deal (After the Bell): its details and the desk workspace. Desk only.
import { Field } from "@/components/ui";
import { notFound, redirect } from "next/navigation";
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeal } from "@/lib/desk";
import { saveListedDeal } from "@/lib/desk-actions";
import { LISTED_TYPES } from "@/lib/stages";
import { DeskWorkspace } from "@/components/DeskWorkspace";

export const dynamic = "force-dynamic";

const IN = (p: { name: string; label: string; value?: string | number | null; ph?: string; mode?: "decimal" }) => <Field {...p} max={200} />;

export default async function ListedDeal({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDesk();
  const id = Number((await params).id);
  const d = await deskDeal(id);
  if (!d) notFound();
  if (!d.listed) redirect(`/admin/deals/${d.id}`);
  const i = d.listedInfo || {};
  const edit = can(me, "deals.edit");
  const back = `/admin/after-the-bell/${d.id}`;
  return (
    <>
      <p className="crumb"><a href="/admin/after-the-bell">← After the Bell</a> · <a href="/admin/board">Deal pipeline</a></p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "6px 0 6px" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>{d.company}</h1><span className="pill">Listed · desk only</span>
        {i.exchange || i.ticker ? <span className="mono fine">{[i.exchange, i.ticker].filter(Boolean).join(": ")}</span> : null}<span className="mono fine" title="Internal reference; there is no public page">ref {d.slug}</span></div>
      <p className="fine" style={{ marginBottom: 14 }}>This deal has no public page, room or NDA, and is never shown to investors.</p>
      <DeskWorkspace d={d} me={me} back={back} />
      <div className="chart" style={{ marginTop: 22 }} id="details"><span className="k">Company and deal</span>
        <form action={saveListedDeal} className="form"><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} />
          <fieldset disabled={!edit} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="row"><IN name="company" label="Company" value={d.company} /><IN name="sector" label="Sector" value={i.sector} /></div>
          <div className="row"><IN name="exchange" label="Exchange" value={i.exchange} ph="NSE" /><IN name="ticker" label="Ticker" value={i.ticker} /></div>
          <div className="row"><IN name="isin" label="ISIN" value={i.isin} /><IN name="marketCap" label="Market cap" value={i.marketCap} ph="₹2,400 Cr" /></div>
          <div className="row"><label>Deal type<select name="dealType" defaultValue={i.dealType || "Block deal"}>{LISTED_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Side<select name="side" defaultValue={i.side || ""}><option value="">—</option><option>Buy side</option><option>Sell side</option><option>Both</option></select></label></div>
          <div className="row"><IN name="sizeCr" label="Size (₹ crore)" value={i.sizeCr ?? ""} mode="decimal" /><IN name="price" label="Price or band" value={i.price} ph="₹110, or 5% below CMP" /></div>
          <div className="row"><IN name="counterparty" label="Counterparty" value={i.counterparty} ph="Seller, buyer or broker" /><IN name="source" label="Source" value={i.source} ph="Who brought it" /></div>
          <IN name="status" label="Status line" value={d.status} />
          <label>Summary<textarea name="summary" rows={4} maxLength={2000} defaultValue={d.headline} /></label>
          {edit && <div><button className="btn primary" type="submit">Save</button></div>}
          </fieldset></form></div>
    </>
  );
}
