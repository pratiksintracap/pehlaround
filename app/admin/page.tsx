import { requireAdmin } from "@/lib/auth";
import { desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, calls, interests, leads, ndas, notifications, offices, questions, users } from "@/db/schema";
import { addAdmin, markDeskRead } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (t: any, where?: ReturnType<typeof sql>) => (await db.select({ n: sql<number>`count(*)::int` }).from(t).where(where))[0].n as number;
  const [o, appr, pan, nd, intr, q, c, l, admins, recent, alerts] = await Promise.all([
    count(offices), count(offices, sql`approval = 'pending'`), count(offices, sql`status = 'pan_submitted'`), count(ndas), count(interests, sql`status = 'Indicated'`),
    count(questions, sql`answer is null and hidden = false`), count(calls, sql`status = 'Requested'`), count(leads, sql`status = 'New'`),
    db.select().from(users).where(sql`role = 'admin'`),
    db.select().from(audit).orderBy(desc(audit.at)).limit(25),
    db.select().from(notifications).where(sql`to_admin = true`).orderBy(desc(notifications.createdAt)).limit(12),
  ]);
  const unread = alerts.filter((a) => !a.readAt).length;
  const tiles: [string, number, string][] = [
    ["Offices awaiting approval", appr, "/admin/offices?show=pending"], ["Family offices registered", o, "/admin/offices"], ["PANs to check", pan, "/admin/offices"], ["NDAs signed", nd, "/admin/offices"],
    ["New allocation requests", intr, "/admin/activity"], ["Questions to answer", q, "/admin/activity#qs"], ["Calls requested", c, "/admin/activity#calls"], ["New founder leads", l, "/admin/activity#leads"],
  ];
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 18px" }}>The desk today</h1>
      <div className="adm-tiles">{tiles.map(([t, v, h]) => <a key={t} href={h} className="snapcell"><span className="k">{t}</span><b>{v}</b></a>)}</div>
      <div className="chart" style={{ marginTop: 24 }}><span className="k">Desk alerts{unread ? ` · ${unread} new` : ""}</span>
        <ul className="feed">{alerts.length ? alerts.map((a) => <li key={a.id} className={a.readAt ? "" : "new"}><span className="mono">{fmtT(a.createdAt)}</span>{a.link ? <a href={a.link}><b>{a.title}</b></a> : <b>{a.title}</b>}{a.body ? <> · <span className="fine">{a.body.slice(0, 160)}</span></> : null}</li>) : <li className="empty-li">No alerts yet.</li>}</ul>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn sm" href="/notifications">All alerts</a>{unread > 0 && <form action={markDeskRead}><button className="btn sm ghost" type="submit">Mark all read</button></form>}<a className="btn sm" href="/admin/notify">Notify offices</a></div></div>
      <div className="two" style={{ marginTop: 24 }}>
        <div className="chart"><span className="k">Recent activity</span>
          <ul className="feed">{recent.map((a) => <li key={a.id}><span className="mono">{fmtT(a.at)}</span>{a.who ? `${a.who}: ` : ""}{a.action}</li>)}</ul>
          <a className="btn sm" href="/admin/log">Full log</a></div>
        <div className="chart"><span className="k">Admins</span>
          <ul className="feed">{admins.map((a) => <li key={a.id}><b>{a.name}</b> · {a.email}</li>)}</ul>
          <form action={addAdmin} className="form" style={{ marginTop: 10 }}>
            <div className="row"><label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label></div>
            <label>Password<input name="password" type="password" minLength={8} required /></label>
            <div><button className="btn sm" type="submit">Add an admin</button></div>
          </form></div>
      </div>
    </>
  );
}
