import { desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deals, offices, ticketMessages, tickets, users } from "@/db/schema";
import { STATUS, catLabel, ticketNo } from "@/lib/tickets";

const VIEWS: [string, string, string[]][] = [["open", "With the desk", ["open"]], ["answered", "Awaiting office", ["answered"]], ["resolved", "Resolved", ["resolved"]], ["closed", "Closed", ["closed"]], ["all", "All", ["open", "answered", "resolved", "closed"]]];
const ago = (d: Date) => { const h = (Date.now() - d.getTime()) / 36e5; return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`; };
const dur = (ms: number) => { const h = ms / 36e5; return h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`; };

/** The desk's support inbox. */
export default async function TicketInbox({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireAdmin();
  const { view = "open" } = await searchParams;
  const v = VIEWS.find((x) => x[0] === view) ?? VIEWS[0];
  const db = await getDb();
  const all = await db.select().from(tickets).orderBy(desc(tickets.updatedAt));
  const list = all.filter((t) => v[2].includes(t.status));
  const ids = list.map((t) => t.id);
  const [os, us, ds, msgs] = await Promise.all([
    db.select({ id: offices.id, name: offices.name }).from(offices), db.select({ id: users.id, name: users.name }).from(users),
    db.select({ id: deals.id, company: deals.company }).from(deals),
    ids.length ? db.select({ ticketId: ticketMessages.ticketId, from: ticketMessages.from, at: ticketMessages.createdAt, internal: ticketMessages.internal }).from(ticketMessages).where(inArray(ticketMessages.ticketId, ids)) : Promise.resolve([]),
  ]);
  const office = new Map(os.map((x) => [x.id, x.name])), user = new Map(us.map((x) => [x.id, x.name])), deal = new Map(ds.map((x) => [x.id, x.company]));
  const lastOffice = new Map<number, Date>(); for (const m of msgs) if (m.from === "office" && (!lastOffice.get(m.ticketId) || m.at > lastOffice.get(m.ticketId)!)) lastOffice.set(m.ticketId, m.at);
  const count = (st: string[]) => all.filter((t) => st.includes(t.status)).length;
  const firsts = all.filter((t) => t.firstReplyAt).map((t) => t.firstReplyAt!.getTime() - t.createdAt.getTime()).sort((a, b) => a - b);
  const med = firsts.length ? firsts[Math.floor(firsts.length / 2)] : null;
  const rated = all.filter((t) => t.rating), avg = rated.length ? rated.reduce((n, t) => n + (t.rating ?? 0), 0) / rated.length : null;
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 6px" }}>Support tickets</h1>
      <p className="fine" style={{ marginBottom: 14 }}>Offices raise these from Help and support on their dashboard. Your reply goes to the office under the bell and by email to the person who raised it.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        <div className="chart"><span className="k">With the desk</span><b style={{ fontSize: 26 }}>{count(["open"])}</b></div>
        <div className="chart"><span className="k">Awaiting office</span><b style={{ fontSize: 26 }}>{count(["answered"])}</b></div>
        <div className="chart"><span className="k">First reply, median</span><b style={{ fontSize: 26 }}>{med === null ? "—" : dur(med)}</b></div>
        <div className="chart"><span className="k">Rating</span><b style={{ fontSize: 26 }}>{avg === null ? "—" : `${avg.toFixed(1)} / 5`}</b><small className="fine">{rated.length} rated</small></div>
      </div>
      <nav className="tk-views">{VIEWS.map(([k, l, st]) => <a key={k} href={`/admin/tickets?view=${k}`} aria-current={k === v[0] ? "page" : undefined}>{l} <em>{count(st)}</em></a>)}</nav>
      {list.length ? (
        <div className="cmpwrap"><table className="cmp plain tk-table"><thead><tr><th>Ticket</th><th>Office · person</th><th>About</th><th>Status</th><th>Waiting</th></tr></thead><tbody>
          {list.map((t) => (
            <tr key={t.id}>
              <th scope="row"><a href={`/admin/tickets/${ticketNo(t.id)}`}><span className="mono">{ticketNo(t.id)}</span><br />{t.subject}</a></th>
              <td>{t.officeId ? office.get(t.officeId) : "—"}<br /><small className="fine">{user.get(t.userId)}</small></td>
              <td>{catLabel(t.category)}{t.dealId ? <><br /><small className="fine">{deal.get(t.dealId)}</small></> : null}</td>
              <td><span className={`pill ${STATUS[t.status]?.pill ?? ""}`}>{STATUS[t.status]?.label ?? t.status}</span>{t.rating ? <><br /><small className="fine">rated {t.rating}/5</small></> : null}</td>
              <td>{t.status === "open" ? <b className={(Date.now() - (lastOffice.get(t.id) ?? t.createdAt).getTime()) > 24 * 36e5 ? "tk-late" : ""}>{ago(lastOffice.get(t.id) ?? t.createdAt)}</b> : <small className="fine">updated {ago(t.updatedAt)} ago</small>}</td>
            </tr>))}
        </tbody></table></div>
      ) : <p className="fine">Nothing here.</p>}
    </>
  );
}
