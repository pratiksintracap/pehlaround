import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { getDb } from "@/lib/db";
import { deals, interests, leads, ndas, offices } from "@/db/schema";
import { officeScope } from "@/lib/desk";
import { saveSeller } from "@/lib/desk-actions";
import { SECTORS } from "@/lib/profile";
import { matchSeller, normCompany } from "@/lib/seller-match";

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

/** Sellers: holders of unlisted shares who asked the desk to find a buyer (the public Sell page), each with the
 *  offices on the desk most worth a call. Desk only. Nothing is sent from here and no office sees a holding. */
export default async function Sellers({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const me = await requireDesk();
  const { show } = await searchParams;
  const edit = can(me, "leads");
  const db = await getDb();
  const [ls, os, ds, ns, is] = await Promise.all([
    db.select().from(leads).where(eq(leads.kind, "seller")).orderBy(desc(leads.createdAt)),
    db.select({ id: offices.id, name: offices.name, investorType: offices.investorType, ticket: offices.ticket, sectors: offices.sectors, structures: offices.structures, aum: offices.aum })
      .from(offices).where(and(eq(offices.approval, "approved"), officeScope(me))),
    db.select({ id: deals.id, company: deals.company }).from(deals),
    db.select({ officeId: ndas.officeId, dealId: ndas.dealId }).from(ndas).where(isNull(ndas.revokedAt)),
    db.select({ officeId: interests.officeId, dealId: interests.dealId }).from(interests).where(ne(interests.status, "Withdrawn")),
  ]);
  const list = show === "all" ? ls : ls.filter((l) => l.status !== "Closed");
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Sellers</h1>
      <p className="fine" style={{ marginBottom: 10 }}>Holders who asked the desk to find a buyer for unlisted shares. For each, the approved offices most worth a call, ranked from what each office put in its investment profile and what it has done on the desk. A holding is never shown to an office from here: call the office, and share the seller&apos;s name only with the seller&apos;s consent.</p>
      <div className="adm-filter"><a href="/admin/sellers" className={show === "all" ? "" : "on"}>Open ({ls.filter((l) => l.status !== "Closed").length})</a><a href="/admin/sellers?show=all" className={show === "all" ? "on" : ""}>All ({ls.length})</a></div>
      {list.length ? list.map((l) => {
        const data = (l.data || {}) as Record<string, string>;
        const same = ds.filter((d) => l.company && normCompany(d.company) === normCompany(l.company)).map((d) => d.id);
        const knows = new Set([...ns, ...is].filter((x) => same.includes(x.dealId)).map((x) => x.officeId));
        const matches = matchSeller({ company: l.company || "", size: data.size || "", sector: data.sector || "" }, os, knows);
        return (
          <section key={l.id} id={`s${l.id}`} className="adm-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{l.company || "Company not given"} <span className={`pill ${l.status === "New" ? "mid" : ""}`}>{l.status}</span>{same.length ? <> <span className="pill ok">On the desk</span></> : null}</h2>
              <span className="fine">{fmtD(l.createdAt)}</span></div>
            <p className="fine">{l.name} · {l.email} · {l.phone}<br />{[data.holder, data.size, data.form && `held ${data.form.toLowerCase()}`, data.listing && `listing: ${data.listing.toLowerCase()}`].filter(Boolean).join(" · ")}{data.note ? <><br />&ldquo;{data.note}&rdquo;</> : null}</p>
            {edit && <form action={saveSeller} className="form"><input type="hidden" name="id" value={l.id} />
              <div className="row3"><label>Company&apos;s sector<select name="sector" defaultValue={data.sector || ""}><option value="">Not set</option>{SECTORS.map(([s]) => <option key={s}>{s}</option>)}</select></label>
                <label>Status<select name="status" defaultValue={l.status}>{["New", "Contacted", "In diligence", "Closed"].map((s) => <option key={s}>{s}</option>)}</select></label>
                <label>Desk note<input name="deskNote" defaultValue={data.deskNote || ""} maxLength={600} placeholder="e.g. 40,000 shares, bought 2022, ROFR applies" /></label></div>
              <div><button className="btn sm" type="submit">Save</button></div></form>}
            <h3 style={{ fontSize: 15, margin: "14px 0 6px" }}>Offices to call</h3>
            {matches.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Office</th><th>Why</th><th /></tr></thead><tbody>
              {matches.map((m) => <tr key={m.officeId}><th scope="row">{m.name}</th><td>{m.why.join(" · ")}</td><td><a className="btn sm" href={`/desk/investors/${m.officeId}`}>Open</a></td></tr>)}
            </tbody></table></div>
              : <p className="fine">{data.sector ? "No approved office matches this holding yet." : "Set the company's sector to see who invests in it; so far no office matches on size or structure alone."}</p>}
          </section>); })
        : <p className="fine">No sellers yet. They come from the public Sell page.</p>}
    </>
  );
}
