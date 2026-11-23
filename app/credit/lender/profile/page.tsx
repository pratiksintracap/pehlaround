import { requireLender } from "@/lib/credit/server/session";
import { getMyProfile } from "@/lib/credit/server/lender/deals";
import { inr, pct } from "@/components/credit/app/ui";

export default async function ProfilePage() {
  const lender = await requireLender();
  const p = await getMyProfile(lender);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Our profile</h1>
          <p className="muted">What the platform team matches deal flow against. To change any of it, contact the platform team.</p>
        </div>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Thesis and appetite</h2>
          <dl className="facts">
            <dt>Ticket size</dt><dd>{p.lender.minTicket || p.lender.maxTicket ? `${inr(p.lender.minTicket)} – ${inr(p.lender.maxTicket)}` : "—"}</dd>
            <dt>Rate band</dt><dd>{p.lender.minRate || p.lender.maxRate ? `${pct(p.lender.minRate)} – ${pct(p.lender.maxRate)}` : "—"}</dd>
            <dt>Risk appetite</dt><dd>{p.securityLevels.join(", ") || "—"}</dd>
            <dt>Instruments</dt><dd>{p.instruments.join(", ") || "—"}</dd>
            <dt>Segments</dt>
            <dd>
              {p.targets.length === 0 ? "—" : p.targets.map((t) => (
                <div key={t.name}>{t.name}{t.targetExposure ? ` (exposure target ${inr(t.targetExposure)})` : ""}</div>
              ))}
            </dd>
            <dt>Notes</dt><dd style={{ whiteSpace: "pre-wrap" }}>{p.lender.thesisNotes ?? "—"}</dd>
          </dl>
        </section>
        <section className="panel">
          <h2>Your exposure on the platform</h2>
          <p className="muted small">Outstanding is disbursed minus repaid, by the segment each raise funds.</p>
          <dl className="facts" style={{ marginBottom: "0.75rem" }}>
            <dt>Outstanding</dt><dd>{inr(p.exposure.totalOutstanding)}</dd>
            <dt>Disbursed to date</dt><dd>{inr(p.exposure.totalDisbursed)}</dd>
          </dl>
          {p.exposure.bySegment.length > 0 && (
            <table>
              <thead><tr><th>Segment</th><th className="num">Target</th><th className="num">Outstanding</th><th className="num">Headroom</th></tr></thead>
              <tbody>
                {p.exposure.bySegment.map((s) => (
                  <tr key={s.segmentId ?? "none"}>
                    <td>{s.segment}</td>
                    <td className="num">{inr(s.target)}</td>
                    <td className="num">{inr(s.outstanding)}</td>
                    <td className="num">{s.headroom != null ? inr(s.headroom) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="panel">
          <h2>Team</h2>
          <table>
            <tbody>
              {p.team.map((t) => (
                <tr key={t.email}><td>{t.name}</td><td className="small">{t.email}</td><td className="small">{t.role === "lender_admin" ? "Admin" : "Viewer"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
