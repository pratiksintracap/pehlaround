import { requireDesk } from "@/lib/auth";
import { and, desc, eq, sql } from "drizzle-orm";
import { isSuper } from "@/lib/perm";
import { getDb } from "@/lib/db";
import { audit, offices } from "@/db/schema";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Log({ searchParams }: { searchParams: Promise<{ office?: string }> }) {
  const me = await requireDesk();
  const all = isSuper(me);
  const { office } = await searchParams;
  const db = await getDb();
  // An analyst sees office activity and their own desk actions; a super admin sees everything.
  const scope = all ? undefined : sql`(${audit.officeId} is not null or ${audit.userId} = ${me.id})`;
  const rows = await db.select().from(audit).where(office ? and(eq(audit.officeId, Number(office)), scope) : scope).orderBy(desc(audit.at)).limit(500);
  const os = new Map((await db.select({ id: offices.id, name: offices.name }).from(offices)).map((o) => [o.id, o.name]));
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Activity log</h1>
      {!all && <p className="fine" style={{ margin: "-8px 0 14px" }}>Office activity and your own desk actions.</p>}
      <div className="cmpwrap"><table className="cmp"><thead><tr><th>When</th><th>Office</th><th>Who</th><th>What</th>{all && <th>IP</th>}</tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{fmtT(r.at)}</td><td>{r.officeId ? <a href={`/admin/log?office=${r.officeId}`}>{os.get(r.officeId)}</a> : "Desk"}</td><td>{r.who || "—"}</td><td>{r.action}</td>{all && <td className="mono">{r.ip || ""}</td>}</tr>)}
      </tbody></table></div>
    </>
  );
}
