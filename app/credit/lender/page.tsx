import Link from "next/link";
import { requireLender } from "@/lib/credit/server/session";
import { getDealFlow } from "@/lib/credit/server/lender/deals";
import { Badge, Check, Fill, Period, inr, pct } from "@/components/credit/app/ui";

export default async function DealFlowPage() {
  const lender = await requireLender();
  const deals = await getDealFlow(lender);
  const live = deals.filter((d) => d.status === "open");
  const past = deals.filter((d) => d.status !== "open");

  const table = (rows: typeof deals) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Borrower</th><th>Period</th><th>Instrument</th><th>Your rate</th><th>Security</th><th>Fit with your profile</th><th>Raise filled</th><th>Your position</th></tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.raiseId}>
              <td>
                <Link href={`/credit/lender/deals/${d.raiseId}`}>{d.borrowerName}</Link>
                <div className="small muted">{d.segments.join(", ")}</div>
              </td>
              <td><Period start={d.cycleStart} cycle={d.cycle} />{d.status !== "open" && <div><Badge status={d.status} /></div>}</td>
              <td>{d.instrument ?? "—"}</td>
              <td>{pct(d.lenderRate)}</td>
              <td>{d.securityLevel ?? "—"}</td>
              <td>
                <div className="inline">
                  <Check value={d.fit.thesis} label={d.fit.targetReached ? "Thesis (target reached)" : "Thesis"} />
                  <Check value={d.fit.instrument} label="Instrument" />
                  <Check value={d.fit.rateBand} label="Rate band" />
                  <Check value={d.fit.riskAppetite} label="Risk appetite" />
                </div>
              </td>
              <td><Fill amount={d.amount} filled={d.filledAmount} /></td>
              <td>
                {d.myAllocation ? <>{inr(d.myAllocation.amount)} <Badge status={d.myAllocation.status} /></> : <span className="muted small">None yet</span>}
                {d.myAllocation?.onOlderTerms && <div><Badge status="refresh_due" label="Terms changed since" /></div>}
                <div className="small muted">Level 2: <Badge status={d.myLevel2} /></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Deal flow</h1>
          <p className="muted">Raises the platform team has matched to your thesis, rate band and risk appetite. Open one to see diligence and terms.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Open raises</h2>
        {live.length === 0 ? (
          <div className="empty">No open raises have been shared with you yet. New matches appear here as raises open.</div>
        ) : table(live)}
      </section>
      {past.length > 0 && (
        <section className="panel">
          <h2>Earlier raises</h2>
          {table(past)}
        </section>
      )}
    </>
  );
}
