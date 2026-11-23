import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listBorrowers } from "@/lib/credit/server/admin/borrowers";
import { listReference } from "@/lib/credit/server/admin/reference";
import { effectiveL1Status } from "@/lib/credit/server/diligence-rules";
import { Badge, cycleLabel, cycleName, date, inr } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { createBorrowerAction } from "../actions";
import { BorrowerFields } from "./BorrowerFields";

export default async function BorrowersPage() {
  const admin = await requireAdmin();
  const [rows, ref] = await Promise.all([listBorrowers(admin), listReference(admin)]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Borrowers</h1>
          <p className="muted">Smaller NBFCs raising on the platform. Level 1 is the platform&apos;s screening, refreshed quarterly or on material change.</p>
        </div>
      </div>

      <section className="panel">
        <h2>All borrowers</h2>
        {rows.length === 0 ? (
          <div className="empty">No borrowers yet. Add the first one below.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Borrower</th><th>Segments</th><th>Status</th><th>Drawdown cycle</th><th>Level 1</th><th>Refresh due</th><th>Latest raise</th><th className="num">Raises</th></tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td><Link href={`/credit/admin/borrowers/${b.id}`}>{b.name}</Link></td>
                    <td>{b.segments.join(", ") || <span className="muted">—</span>}</td>
                    <td><Badge status={b.status} /></td>
                    <td>{cycleName(b.drawdownCycle)}</td>
                    <td><Badge status={effectiveL1Status(b.l1)} /></td>
                    <td>{date(b.l1?.refreshDueAt)}</td>
                    <td>{b.latestRaise ? `${cycleLabel(b.latestRaise.cycleStart, b.latestRaise.cycle)} · ${inr(b.latestRaise.amount)}` : <span className="muted">—</span>}</td>
                    <td className="num">{b.raiseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Add a borrower</h2>
        {ref.checklist.length === 0 && (
          <p className="note">
            The default Level 1 checklist is empty. <Link href="/credit/admin/settings">Define it in Settings</Link> so new borrowers start with it.
          </p>
        )}
        <ActionForm action={createBorrowerAction}>
          <BorrowerFields segments={ref.segments} />
          <div><Submit>Add borrower</Submit></div>
        </ActionForm>
      </section>
    </>
  );
}
