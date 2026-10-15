import { sql } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listDeals } from "@/lib/deals";
import { createDeal } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";
import { offereeCounts, offereeLevel } from "@/lib/offerees";
import { OFFEREE_LIMIT } from "@/lib/investor";

export default async function AdminDeals({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const me = await requireDesk();
  const { msg } = await searchParams;
  const deals = await listDeals(true);
  const db = await getDb();
  const off = await offereeCounts();
  // Funnel per deal over the last 30 days: overview views → offices that opened the room → NDAs → allocation requests.
  type Row = { deal_id: number; n: number };
  const q = async (s: ReturnType<typeof sql>) => new Map(((await db.execute(s)) as unknown as { rows: Row[] }).rows.map((r) => [Number(r.deal_id), Number(r.n)]));
  const [views, rooms, ndaN, asks] = await Promise.all([
    q(sql`select deal_id, count(*)::int as n from deal_views where at > now() - interval '30 days' group by deal_id`),
    q(sql`select deal_id, count(distinct office_id)::int as n from audit where deal_id is not null and office_id is not null and action like 'Opened the room:%' and at > now() - interval '30 days' group by deal_id`),
    q(sql`select deal_id, count(*)::int as n from ndas where revoked_at is null group by deal_id`),
    q(sql`select deal_id, count(*)::int as n from interests group by deal_id`),
  ]);
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Deals</h1>
      <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Company</th><th>Public title</th><th>Structure</th><th>Listing</th><th>Desk Score</th><th title="Last 30 days">Overview views</th><th title="Offices, last 30 days">Rooms opened</th><th>NDAs</th><th title={`Offices shown the company this financial year, excluding SEBI-registered AIFs. Companies Act limit: ${OFFEREE_LIMIT} per year.`}>Offerees {off.fy}</th><th>Allocation requests</th><th>Shown</th><th /></tr></thead><tbody>
        {deals.map((d) => { return (
          <tr key={d.id}><th scope="row">{d.company}</th><td>{d.title}</td><td>{d.category}</td><td>{d.listingLabel}</td><td>{d.score != null ? d.score.toFixed(1) : "—"}</td><td>{views.get(d.id) ?? 0}</td><td>{rooms.get(d.id) ?? 0}</td><td>{ndaN.get(d.id) ?? 0}</td><td>{(() => { const n = off.counts.get(d.id) ?? 0, l = offereeLevel(n); return <span className={l === "ok" ? "" : "pill " + (l === "over" ? "bad" : "mid")}>{n} / {OFFEREE_LIMIT}</span>; })()}</td><td>{asks.get(d.id) ?? 0}</td>
            <td>{d.published ? (d.open ? "Live · room open" : "Live · room closed") : <span title="Not on the site; the desk alone sees it">In preparation</span>}</td>
            <td><div style={{ display: "flex", gap: 6 }}><a className="btn sm primary" href={`/admin/deals/${d.id}`}>Edit</a><a className="btn sm" href={`/admin/pipeline?deal=${d.slug}`}>Pipeline</a><a className="btn sm" href={`/room/${d.slug}`}>Room</a></div></td></tr>); })}
      </tbody></table></div>
      <div className="chart" style={{ marginTop: 22 }}><span className="k">Add a deal</span>
        <form action={createDeal} className="form"><div className="row">
          <label>Company (legal name)<input name="company" required /></label><label>Public title (anonymised sector)<input name="title" required placeholder="e.g. Specialty chemicals" /></label></div>
          <label>Web address slug<input name="slug" required placeholder="e.g. specialty-chemicals-pre-ipo" /><span className="hint">Shown in the link; keep it anonymised.</span></label>
          <div><button className="btn" type="submit">Create, in preparation</button><span className="hint" style={{ marginLeft: 10 }}>Not on the site until Published is ticked on the deal.</span></div></form></div>
    </>
  );
}
