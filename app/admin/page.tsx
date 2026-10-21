import { requireDesk } from "@/lib/auth";
import { can, isSuper, mask, ROLE_LABEL, type DeskRole } from "@/lib/perm";
import { getSettings } from "@/lib/settings";
import { desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, calls, interests, leads, ndas, notifications, offices, questions, users } from "@/db/schema";
import { markDeskRead } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";
import { myDesk, deskMembers, names } from "@/lib/desk";
import { stageLabel } from "@/lib/stages";
import { TYPE_LABEL, type InvestorType } from "@/lib/investor";
import { TaskRow } from "@/components/DeskBits";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const me = await requireDesk();
  const { msg } = await searchParams;
  const seeContacts = can(me, "contacts.view", { analystContacts: (await getSettings()).analystContacts });
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (t: any, where?: ReturnType<typeof sql>) => (await db.select({ n: sql<number>`count(*)::int` }).from(t).where(where))[0].n as number;
  const [o, appr, nd, intr, q, c, l, admins, recent, alerts] = await Promise.all([
    count(offices, sql`origin = 'registered'`), count(offices, sql`approval = 'pending'`), count(ndas), count(interests, sql`status = 'Indicated'`),
    count(questions, sql`answer is null and hidden = false`), count(calls, sql`status = 'Requested'`), count(leads, sql`status = 'New'`),
    db.select().from(users).where(sql`role in ('admin', 'analyst') and disabled = false`),
    // An analyst sees office activity and their own desk actions, not other desk members'.
    db.select().from(audit).where(isSuper(me) ? undefined : sql`office_id is not null or user_id = ${me.id}`).orderBy(desc(audit.at)).limit(25),
    db.select().from(notifications).where(sql`to_admin = true`).orderBy(desc(notifications.createdAt)).limit(12),
  ]);
  const unread = alerts.filter((a) => !a.readAt).length;
  const [desk, members, nm, added] = await Promise.all([myDesk(me), deskMembers(), names(), count(offices, sql`origin = 'desk'`)]);
  const opts = { members: members.map((m) => ({ id: m.id, name: m.name })), deals: [...nm.deal.values()].map((x) => ({ id: x.id, name: x.company })), offices: [...nm.office.entries()].map(([id, name]) => ({ id, name })) };
  const myOver = desk.myTasks.filter((t) => t.dueOn && t.dueOn < new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10)).length;
  // Offices active in a room this week that have neither requested an allocation nor passed: the desk's call list.
  type Lead = { office: string; company: string; n: number; last: string; contact: string | null; phone: string | null };
  const toCall = ((await db.execute(sql`
    select o.name as office, d.company, count(*)::int as n, max(a.at) as last,
      (select u.name from users u where u.office_id = a.office_id order by u.id limit 1) as contact,
      (select u.phone from users u where u.office_id = a.office_id order by u.id limit 1) as phone
    from audit a join offices o on o.id = a.office_id join deals d on d.id = a.deal_id
    where a.at > now() - interval '7 days' and a.deal_id is not null
      and not exists (select 1 from interests i where i.office_id = a.office_id and i.deal_id = a.deal_id)
      and not exists (select 1 from passes p where p.office_id = a.office_id and p.deal_id = a.deal_id)
    group by a.office_id, a.deal_id, o.name, d.company order by n desc, last desc limit 12`)) as unknown as { rows: Lead[] }).rows;
  const tiles: [string, number, string][] = [
    ["Offices awaiting approval", appr, "/admin/offices?show=pending"], ["Investors registered", o, "/admin/offices?show=registered"], ["Added by the desk", added, "/admin/offices?show=desk"], ["NDAs signed", nd, "/admin/offices"],
    ["New allocation requests", intr, "/admin/activity"], ["Questions to answer", q, "/admin/activity#qs"], ["Calls requested", c, "/admin/activity#calls"], ["New founder leads", l, "/admin/activity#leads"],
  ];
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 18px" }}>The desk today</h1>
      <section className="chart my-desk" aria-label="Your desk" style={{ marginBottom: 22 }}>
        <span className="k">Your desk · {me.name} · {ROLE_LABEL[me.role as DeskRole]}</span>
        <div className="md-grid">
          <div><h3 className="md-h">Your open deals <em>{desk.mine.length}</em></h3>
            <ul className="feed">{desk.mine.length ? desk.mine.map((d) => <li key={d.id}><a href={d.listed ? `/admin/after-the-bell/${d.id}` : `/admin/deals/${d.id}#desk`}><b>{d.company}</b></a> · {stageLabel(d.pipelineStage)}{d.listed ? " · listed" : ""}</li>)
              : <li className="empty-li">No deals in your name. Set yourself as owner on a deal, or see the <a href="/admin/board">deal pipeline</a>.</li>}</ul>
            {desk.unowned.length > 0 && <p className="fine">{desk.unowned.length} {desk.unowned.length === 1 ? "deal has" : "deals have"} no owner: <a href="/admin/board?who=none">assign</a>.</p>}</div>
          <div><h3 className="md-h">Waiting for approval <em>{desk.pending.length}</em></h3>
            <ul className="feed">{desk.pending.length ? desk.pending.map((o) => <li key={o.id}><a href={`/admin/offices?show=pending#o${o.id}`}><b>{o.name}</b></a> · {TYPE_LABEL[o.investorType as InvestorType] || "Family office"} · {fmtT(o.createdAt)}</li>)
              : <li className="empty-li">Nobody waiting.</li>}</ul>
            {can(me, "offices.approve") ? null : <p className="fine">A super admin approves offices.</p>}</div>
          <div><h3 className="md-h">Your tasks <em>{desk.myTasks.length}</em>{myOver ? <span className="pill bad">{myOver} overdue</span> : null}</h3>
            <ul className="tk-list">{desk.myTasks.length ? desk.myTasks.slice(0, 8).map((t) => <TaskRow key={t.id} t={t} back="/admin" del={can(me, "delete")} {...opts} />) : <li className="empty-li">No open tasks.</li>}</ul>
            <a className="btn sm" href="/admin/tasks">All tasks</a>{isSuper(me) && desk.overdueAll ? <span className="fine"> · {desk.overdueAll} overdue across the desk: <a href="/admin/tasks?who=all">see</a></span> : null}</div>
        </div>
      </section>
      <div className="adm-tiles">{tiles.map(([t, v, h]) => <a key={t} href={h} className="snapcell"><span className="k">{t}</span><b>{v}</b></a>)}</div>
      <div className="chart" style={{ marginTop: 24 }}><span className="k">Desk alerts{unread ? ` · ${unread} new` : ""}</span>
        <ul className="feed">{alerts.length ? alerts.map((a) => <li key={a.id} className={a.readAt ? "" : "new"}><span className="mono">{fmtT(a.createdAt)}</span>{a.link ? <a href={a.link}><b>{a.title}</b></a> : <b>{a.title}</b>}{a.body ? <> · <span className="fine">{a.body.slice(0, 160)}</span></> : null}</li>) : <li className="empty-li">No alerts yet.</li>}</ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn sm" href="/notifications">All alerts</a>{unread > 0 && <form action={markDeskRead}><button className="btn sm ghost" type="submit">Mark all read</button></form>}<a className="btn sm" href="/admin/notify">Notify offices</a></div></div>
      <div className="chart" style={{ marginTop: 24 }}><span className="k">Who to call today</span>
        <p className="fine" style={{ margin: "4px 0 8px" }}>Offices that opened a room, read documents or asked a question in the last seven days, and have not yet indicated an amount or passed.</p>
        {toCall.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Office</th><th>Company</th><th>Actions this week</th><th>Last seen</th><th>Contact</th></tr></thead><tbody>
          {toCall.map((r, i) => <tr key={i}><th scope="row">{r.office}</th><td>{r.company}</td><td>{r.n}</td><td>{fmtT(new Date(r.last))}</td><td>{r.contact || "—"}{r.phone ? (seeContacts ? <> · <a href={`tel:${r.phone.replace(/\s/g, "")}`}>{r.phone}</a></> : <> · <span className="mono">{mask(r.phone)}</span></>) : null}</td></tr>)}
        </tbody></table></div> : <p className="fine">Nobody to chase this week.</p>}</div>
      <div className="two" style={{ marginTop: 24 }}>
        <div className="chart"><span className="k">Recent activity</span>
          <ul className="feed">{recent.map((a) => <li key={a.id}><span className="mono">{fmtT(a.at)}</span>{a.who ? `${a.who}: ` : ""}{a.action}</li>)}</ul>
          <a className="btn sm" href="/admin/log">Full log</a></div>
        <div className="chart"><span className="k">Desk team</span>
          <ul className="feed">{admins.map((a) => <li key={a.id}><b>{a.name}</b> · {ROLE_LABEL[a.role as DeskRole] ?? a.role}{a.id === me.id ? " · you" : ""}</li>)}</ul>
          {isSuper(me) ? <a className="btn sm" href="/admin/team">Manage the desk team</a>
            : <p className="fine">You are signed in as an analyst. Publishing, allocations, messages to all offices and settings go to a super admin.</p>}</div>
      </div>
    </>
  );
}
