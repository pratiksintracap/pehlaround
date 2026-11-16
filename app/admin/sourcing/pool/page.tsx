// The sourcing pool: companies from a data export that fit the desk's filters. The assistant takes the highest-scored
// ones each weekday morning, checks each against public sources, and moves the good ones to Sourcing with an email
// written for approval. Desk only.
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { poolSearch, poolStats } from "@/lib/pool";
import { PoolUpload } from "@/components/PoolUpload";

export const dynamic = "force-dynamic";
const cr = (v: number | null) => (v == null ? "—" : `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`);

export default async function Pool({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const me = await requireDesk();
  const { q = "", show = "waiting" } = await searchParams;
  const [st, rows] = await Promise.all([poolStats(), poolSearch(q, show)]);
  return (
    <>
      <p className="fine" style={{ margin: "6px 0 0" }}><a href="/admin/sourcing">← Sourcing</a></p>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "4px 0 6px" }}><h1 style={{ fontSize: 30, margin: 0 }}>Sourcing pool</h1><span className="pill">Desk only</span></div>
      <p className="fine" style={{ marginBottom: 12 }}>Unlisted, profitable companies with ₹50–1,000 Cr revenue, loaded from the desk&apos;s data export. Each weekday morning the assistant takes the top of this list, checks each company against public sources, and moves up to 25 to <a href="/admin/sourcing">Sourcing</a> with an email written for approval. Order: closest to IPO-ready, then a named contact, then Maharashtra.</p>
      <div className="adm-filter" style={{ gap: 18 }}><span><b>{st.waiting.toLocaleString("en-IN")}</b> waiting</span><span>{st.named.toLocaleString("en-IN")} of them with a named contact</span><span>{st.prospects} moved to Sourcing</span><span>{st.skipped} skipped</span><span>{st.total.toLocaleString("en-IN")} in all</span></div>
      <form className="adm-filter" action="/admin/sourcing/pool"><input name="q" defaultValue={q} placeholder="Search company, sector or city" aria-label="Search" style={{ minWidth: 260 }} />
        <select name="show" defaultValue={show} aria-label="Show"><option value="waiting">Waiting</option><option value="skipped">Skipped</option><option value="all">All</option></select><button className="btn sm" type="submit">Search</button></form>
      {rows.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Company</th><th>Revenue</th><th>PAT</th><th>Margin</th><th>Sector</th><th>Contact</th><th>Status</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}>
          <td className="atb-co"><b>{r.company}</b><small className="fine" style={{ display: "block" }}>{[r.legalName, r.city, r.fy].filter(Boolean).join(" · ")}</small>
            {r.website && <small style={{ display: "block" }}><a href={r.website} target="_blank" rel="noopener noreferrer">Website</a>{r.publicLtd ? " · public limited" : ""}</small>}</td>
          <td>{cr(r.revenueCr)}</td><td>{cr(r.patCr)}</td><td>{r.revenueCr && r.patCr != null ? `${((100 * r.patCr) / r.revenueCr).toFixed(0)}%` : "—"}</td>
          <td style={{ maxWidth: 220 }}><span className="fine">{r.sector || "—"}</span></td>
          <td>{r.contactName || "—"}{r.contactRole ? <small className="fine" style={{ display: "block" }}>{r.contactRole}</small> : null}<small className="mono" style={{ display: "block" }}>{r.contactEmail || r.companyEmail || ""}</small></td>
          <td><span className="fine">{r.outcome ?? "Waiting"}</span></td></tr>)}
      </tbody></table></div> : <p className="fine">{st.total ? "Nothing matches." : "The pool is empty. Upload the pool file below."}</p>}
      <p className="fine">Showing the first {rows.length} by priority.</p>
      {can(me, "deals.edit") && <div className="chart" style={{ marginTop: 18 }}><span className="k">Load or refresh the pool</span>
        <p className="fine" style={{ margin: "0 0 10px" }}>Upload the prepared CSV. Companies already here are refreshed, and ones already checked keep their outcome. The file stays in the console&apos;s database; it is not stored anywhere else.</p><PoolUpload /></div>}
    </>
  );
}
