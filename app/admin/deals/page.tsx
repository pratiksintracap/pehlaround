import { requireAdmin } from "@/lib/auth";
import { listDeals, trackerCounts } from "@/lib/deals";
import { createDeal } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";

export default async function AdminDeals({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const deals = await listDeals(true);
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Deals</h1>
      <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Company</th><th>Public title</th><th>Structure</th><th>Listing</th><th>Checks</th><th>Shown</th><th /></tr></thead><tbody>
        {deals.map((d) => { const c = trackerCounts(d); return (
          <tr key={d.id}><th scope="row">{d.company}</th><td>{d.title}</td><td>{d.category}</td><td>{d.listingLabel}</td><td>{c.done} done · {c.prog} in progress · {c.pend} pending</td>
            <td>{d.published ? (d.open ? "Live · room open" : "Live · room closed") : "Hidden"}</td>
            <td><div style={{ display: "flex", gap: 6 }}><a className="btn sm primary" href={`/admin/deals/${d.id}`}>Edit</a><a className="btn sm" href={`/room/${d.slug}`}>Room</a></div></td></tr>); })}
      </tbody></table></div>
      <div className="chart" style={{ marginTop: 22 }}><span className="k">Add a deal</span>
        <form action={createDeal} className="form"><div className="row">
          <label>Company (legal name)<input name="company" required /></label><label>Public title (anonymised sector)<input name="title" required placeholder="e.g. Specialty chemicals" /></label></div>
          <label>Web address slug<input name="slug" required placeholder="e.g. specialty-chemicals-pre-ipo" /><span className="hint">Shown in the link; keep it anonymised.</span></label>
          <div><button className="btn" type="submit">Create as hidden draft</button></div></form></div>
    </>
  );
}
