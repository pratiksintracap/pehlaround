import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listActivity } from "@/lib/credit/server/admin/overview";
import { dateTime } from "@/components/credit/app/ui";

const ENTITY_LINK: Record<string, string> = { borrower: "/credit/admin/borrowers/", raise: "/credit/admin/raises/", lender: "/credit/admin/lenders/" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ entity?: string; id?: string }> }) {
  const admin = await requireAdmin();
  const { entity, id } = await searchParams;
  const rows = await listActivity(admin, { entityType: entity, entityId: id, limit: 500 });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity log</h1>
          <p className="muted">Every change on the platform: who made it, what changed and when. Entries can&apos;t be edited or deleted.</p>
        </div>
        {entity && <Link className="button secondary" href="/credit/admin/activity">Show all</Link>}
      </div>
      <section className="panel">
        {rows.length === 0 ? <div className="empty">No activity recorded{entity ? " for this item" : ""} yet.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When (IST)</th><th>Who</th><th>Action</th><th>On</th><th>Details</th></tr></thead>
              <tbody>
                {rows.map(({ log, actorName, actorEmail }) => (
                  <tr key={log.id}>
                    <td className="small">{dateTime(log.createdAt)}</td>
                    <td className="small">{actorName ? <>{actorName}<div className="muted">{actorEmail}</div></> : log.actorRole}</td>
                    <td className="small">{log.action}</td>
                    <td className="small">
                      {log.entityId && ENTITY_LINK[log.entityType] ? <Link href={`${ENTITY_LINK[log.entityType]}${log.entityId}`}>{log.entityType}</Link> : log.entityType}
                    </td>
                    <td className="small">
                      {log.details ? (
                        <details>
                          <summary>View</summary>
                          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.78rem", maxWidth: 480 }}>{JSON.stringify(log.details, null, 2)}</pre>
                        </details>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
