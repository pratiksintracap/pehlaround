import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listRaises } from "@/lib/credit/server/admin/raises";
import { Badge, Fill, cycleLabel, cycleName, pct } from "@/components/credit/app/ui";

export default async function RaisesPage() {
  const admin = await requireAdmin();
  const rows = await listRaises(admin);
  // One section per period (start month + cycle), newest first. Borrowers on different cycles get separate sections.
  const periodKey = (r: (typeof rows)[number]) => `${r.raise.cycleStart}|${r.raise.cycle}`;
  const periods = [...new Map(rows.map((r) => [periodKey(r), { key: periodKey(r), start: r.raise.cycleStart, cycle: r.raise.cycle }])).values()];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Raises</h1>
          <p className="muted">Every borrower&apos;s funding proposal, by period. Each borrower draws down monthly, quarterly or yearly. Start new raises from the borrower&apos;s page.</p>
        </div>
      </div>
      {periods.length === 0 && <div className="empty">No raises yet. Open a borrower and create its first raise.</div>}
      {periods.map((c) => (
        <section className="panel" key={c.key}>
          <h2>{cycleLabel(c.start, c.cycle)} <span className="small muted">{cycleName(c.cycle)}</span></h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Borrower</th><th>Status</th><th>Security</th><th>Borrower rate</th><th>Lender rate</th><th>Spread</th><th>Shared</th><th>Sell-down</th></tr>
              </thead>
              <tbody>
                {rows.filter((r) => periodKey(r) === c.key).map((r) => (
                  <tr key={r.raise.id}>
                    <td><Link href={`/credit/admin/raises/${r.raise.id}`}>{r.borrowerName}</Link></td>
                    <td><Badge status={r.raise.status} /></td>
                    <td>{r.securityLevel ?? <span className="muted">—</span>}</td>
                    <td>{pct(r.borrowerRate)}</td>
                    <td>{pct(r.raise.lenderRate)}</td>
                    <td>{pct(r.spread)}</td>
                    <td>{r.shares}</td>
                    <td><Fill amount={r.raise.amount} filled={r.raise.filledAmount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
