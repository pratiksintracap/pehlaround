import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listLenders } from "@/lib/credit/server/admin/lenders";
import { listReference } from "@/lib/credit/server/admin/reference";
import { Badge, inr, pct } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { createLenderAction } from "../actions";
import { LenderFields } from "./LenderFields";

export default async function LendersPage() {
  const admin = await requireAdmin();
  const [rows, ref] = await Promise.all([listLenders(admin), listReference(admin)]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lenders</h1>
          <p className="muted">Larger NBFCs on the lending side, with the thesis, ticket size, rate band and risk appetite used for matching.</p>
        </div>
      </div>
      <section className="panel">
        <h2>All lenders</h2>
        {rows.length === 0 ? (
          <div className="empty">No lenders yet. Add the first one below.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lender</th><th>Thesis</th><th>Instruments</th><th>Ticket</th><th>Rate band</th><th>Risk appetite</th><th className="num">Outstanding</th><th></th></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/credit/admin/lenders/${l.id}`}>{l.name}</Link></td>
                    <td>{l.segments.join(", ") || <span className="muted">—</span>}</td>
                    <td>{l.instruments.join(", ") || <span className="muted">—</span>}</td>
                    <td>{l.minTicket || l.maxTicket ? `${inr(l.minTicket)} – ${inr(l.maxTicket)}` : <span className="muted">—</span>}</td>
                    <td>{l.minRate || l.maxRate ? `${pct(l.minRate)} – ${pct(l.maxRate)}` : <span className="muted">—</span>}</td>
                    <td>{l.securityLevels.join(", ") || <span className="muted">—</span>}</td>
                    <td className="num">{inr(l.outstanding)}</td>
                    <td>{!l.active && <Badge status="inactive" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <h2>Add a lender</h2>
        <ActionForm action={createLenderAction}>
          <LenderFields segments={ref.segments} securityLevels={ref.securityLevels} instruments={ref.instruments} />
          <div><Submit>Add lender</Submit></div>
        </ActionForm>
      </section>
    </>
  );
}
