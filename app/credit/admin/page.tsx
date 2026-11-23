import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { pipelineOverview } from "@/lib/credit/server/admin/overview";
import { listRaises } from "@/lib/credit/server/admin/raises";
import { listPending } from "@/lib/credit/server/admin/approvals";
import { Badge, Fill, Period, cycleLabel, inr, pct } from "@/components/credit/app/ui";

export default async function AdminHome() {
  const admin = await requireAdmin();
  const [o, raises, pending] = await Promise.all([pipelineOverview(admin), listRaises(admin), listPending(admin)]);
  const forMe = pending.filter((p) => p.a.requestedBy !== admin.userId);
  const open = raises.filter((r) => r.raise.status === "open");
  const stat = (s: string) => o.byStatus.find((b) => b.status === s);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p className="muted">Raises across the borrower cohort (each on its monthly, quarterly or yearly cycle), diligence that needs attention, and new access requests.</p>
        </div>
        <Link className="button" href="/credit/admin/borrowers">Start a raise</Link>
      </div>

      <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
        <div className="stat">
          <span className="muted small">Open raises</span>
          <strong>{stat("open")?.n ?? 0}</strong>
          <span className="small muted">{inr(stat("open")?.filled ?? "0")} filled of {inr(stat("open")?.total ?? "0")}</span>
        </div>
        <div className="stat">
          <span className="muted small">Level 1 approved and current</span>
          <strong>{o.l1Counts.approved ?? 0}</strong>
          <span className="small muted">{(o.l1Counts.refresh_due ?? 0) + (o.l1Counts.refresh_required ?? 0)} need a refresh</span>
        </div>
        <div className="stat">
          <span className="muted small">New access requests</span>
          <strong>{o.newAccessRequests}</strong>
          <Link className="small" href="/credit/admin/access-requests">Review requests</Link>
        </div>
      </div>

      {pending.length > 0 && (
        <section className="panel" style={{ borderColor: "var(--warn)" }}>
          <h2>Approvals</h2>
          <p className="muted small">{forMe.length} waiting for you · {pending.length - forMe.length} of yours waiting for another admin</p>
          <table>
            <tbody>
              {pending.map((p) => (
                <tr key={p.a.id}>
                  <td><Link href={`/credit/admin/raises/${p.a.raiseId}`}>{p.borrowerName}, {cycleLabel(p.cycleStart, p.cycle)}</Link></td>
                  <td>{p.a.kind === "share" ? "Share with lenders" : `Sanction ${inr((p.a.payload as { amount: string }).amount)}`}</td>
                  <td className="small muted">Requested by {p.a.requestedBy === admin.userId ? "you" : p.requestedByName}</td>
                  <td>{p.a.requestedBy !== admin.userId ? <Badge status="new" label="Your approval needed" /> : <Badge status="idle" label="Waiting" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="panel">
        <h2>Open raises</h2>
        {open.length === 0 ? (
          <div className="empty">No raises are open. Open a raise from its page once Level 1 diligence is approved.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Borrower</th><th>Period</th><th>Lender rate</th><th>Spread</th><th>Shared with</th><th>Sell-down</th></tr>
              </thead>
              <tbody>
                {open.map((r) => (
                  <tr key={r.raise.id}>
                    <td><Link href={`/credit/admin/raises/${r.raise.id}`}>{r.borrowerName}</Link></td>
                    <td><Period start={r.raise.cycleStart} cycle={r.raise.cycle} /></td>
                    <td>{pct(r.raise.lenderRate)}</td>
                    <td>{pct(r.spread)}</td>
                    <td>{r.shares} lender{r.shares === 1 ? "" : "s"}</td>
                    <td><Fill amount={r.raise.amount} filled={r.raise.filledAmount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Diligence needing attention</h2>
        {o.needsAttention.length === 0 ? (
          <div className="empty">Nothing waiting. Level 1 reviews in progress and due refreshes will appear here.</div>
        ) : (
          <table>
            <thead><tr><th>Borrower</th><th>Level 1</th></tr></thead>
            <tbody>
              {o.needsAttention.map((r) => (
                <tr key={r.borrowerId}>
                  <td><Link href={`/credit/admin/borrowers/${r.borrowerId}`}>{r.name}</Link></td>
                  <td><Badge status={r.effective} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
