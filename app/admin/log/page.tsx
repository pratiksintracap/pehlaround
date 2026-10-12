import { requireAdmin } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, offices } from "@/db/schema";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function Log({ searchParams }: { searchParams: Promise<{ office?: string }> }) {
  await requireAdmin();
  const { office } = await searchParams;
  const db = await getDb();
  const q = db.select().from(audit);
  const rows = await (office ? q.where(eq(audit.officeId, Number(office))) : q).orderBy(desc(audit.at)).limit(500);
  const os = new Map((await db.select({ id: offices.id, name: offices.name }).from(offices)).map((o) => [o.id, o.name]));
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Activity log</h1>
      <div className="cmpwrap"><table className="cmp"><thead><tr><th>When</th><th>Office</th><th>Who</th><th>What</th><th>IP</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td>{fmtT(r.at)}</td><td>{r.officeId ? <a href={`/admin/log?office=${r.officeId}`}>{os.get(r.officeId)}</a> : "Desk"}</td><td>{r.who || "—"}</td><td>{r.action}</td><td className="mono">{r.ip || ""}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
