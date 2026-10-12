import { requireAdmin } from "@/lib/auth";
import { desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, calls, interests, leads, ndas, offices, questions, users } from "@/db/schema";
import { addAdmin } from "@/lib/admin-actions";
import { Msg } from "@/components/AdminBits";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin();
  const { msg } = await searchParams;
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (t: any, where?: ReturnType<typeof sql>) => (await db.select({ n: sql<number>`count(*)::int` }).from(t).where(where))[0].n as number;
  const [o, pan, nd, intr, q, c, l, admins, recent] = await Promise.all([
    count(offices), count(offices, sql`status = 'pan_submitted'`), count(ndas), count(interests, sql`status = 'Indicated'`),
    count(questions, sql`answer is null and hidden = false`), count(calls, sql`status = 'Requested'`), count(leads, sql`status = 'New'`),
    db.select().from(users).where(sql`role = 'admin'`),
    db.select().from(audit).orderBy(desc(audit.at)).limit(25),
  ]);
  const tiles: [string, number, string][] = [
    ["Family offices registered", o, "/admin/offices"], ["PANs to check", pan, "/admin/offices"], ["NDAs signed", nd, "/admin/offices"],
    ["New allocation requests", intr, "/admin/activity"], ["Questions to answer", q, "/admin/activity#qs"], ["Calls requested", c, "/admin/activity#calls"], ["New founder leads", l, "/admin/activity#leads"],
  ];
  return (
    <>
      <Msg msg={msg} />
      <h1 style={{ fontSize: 30, margin: "6px 0 18px" }}>The desk today</h1>
      <div className="adm-tiles">{tiles.map(([t, v, h]) => <a key={t} href={h} className="snapcell"><span className="k">{t}</span><b>{v}</b></a>)}</div>
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
