import { requireDesk } from "@/lib/auth";
import { and, desc, eq, sql } from "drizzle-orm";
import { isSuper } from "@/lib/perm";
import { getDb } from "@/lib/db";
import { audit, deals, offices } from "@/db/schema";
import { Changes } from "@/components/DeskBits";

const fmtT = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const ENTITIES: [string, string][] = [["", "Everything"], ["desk", "Desk changes"], ["deal", "Deals"], ["task", "Tasks"], ["note", "Notes"], ["file", "Desk files"], ["office", "Offices"], ["investor", "Investors added"]];

export default async function Log({ searchParams }: { searchParams: Promise<{ office?: string; deal?: string; kind?: string }> }) {
  const me = await requireDesk();
  const all = isSuper(me);
  const { office, deal, kind = "" } = await searchParams;
  const db = await getDb();
  // An analyst sees office activity and their own desk actions; a super admin sees everything.
  const scope = all ? undefined : sql`(${audit.officeId} is not null or ${audit.userId} = ${me.id})`;
  const conds = [scope, office ? eq(audit.officeId, Number(office)) : undefined, deal ? eq(audit.dealId, Number(deal)) : undefined,
    kind === "desk" ? sql`${audit.entity} is not null` : kind ? eq(audit.entity, kind) : undefined].filter(Boolean);
  const rows = await db.select().from(audit).where(conds.length ? and(...conds) : undefined).orderBy(desc(audit.at)).limit(500);
  const os = new Map((await db.select({ id: offices.id, name: offices.name }).from(offices)).map((o) => [o.id, o.name]));
  const ds = new Map((await db.select({ id: deals.id, company: deals.company, listed: deals.listed }).from(deals)).map((d) => [d.id, d]));
  const q = (k: string, v: string) => { const p = new URLSearchParams(Object.entries({ office: office || "", deal: deal || "", kind, [k]: v }).filter(([, x]) => x) as [string, string][]); const s = p.toString(); return `/admin/log${s ? `?${s}` : ""}`; };
  return (
    <>
      <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Activity log</h1>
      {!all && <p className="fine" style={{ margin: "-8px 0 14px" }}>Office activity and your own desk actions.</p>}
      <div className="adm-filter">{ENTITIES.map(([k, l]) => <a key={k} href={q("kind", k)} className={kind === k ? "on" : ""}>{l}</a>)}
        {deal && <a href={q("deal", "")} className="on">Deal: {ds.get(Number(deal))?.company} ✕</a>}{office && <a href={q("office", "")} className="on">Office: {os.get(Number(office))} ✕</a>}</div>
      <div className="cmpwrap"><table className="cmp"><thead><tr><th>When</th><th>Office</th><th>Deal</th><th>Who</th><th>What</th>{all && <th>IP</th>}</tr></thead><tbody>
        {rows.map((r) => { const d = r.dealId ? ds.get(r.dealId) : null; return (
          <tr key={r.id}><td>{fmtT(r.at)}</td><td>{r.officeId ? <a href={q("office", String(r.officeId))}>{os.get(r.officeId)}</a> : "Desk"}</td>
            <td>{d ? <a href={q("deal", String(d.id))}>{d.company}</a> : "—"}</td><td>{r.who || "—"}</td><td>{r.action}<Changes d={r.detail} /></td>{all && <td className="mono">{r.ip || ""}</td>}</tr>); })}
      </tbody></table></div>
    </>
  );
}
