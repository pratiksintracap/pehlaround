import Link from "next/link";
import { requirePartner } from "@/lib/credit/server/session";
import { listMySubmissions } from "@/lib/credit/server/intake/partner";
import { Badge, date } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { createSubmissionAction } from "./actions";
import { INTAKE_STATUS_LABEL } from "./labels";

export default async function PartnerHome() {
  const partner = await requirePartner();
  const rows = await listMySubmissions(partner);
  const needsInfo = rows.filter((r) => r.status === "needs_info");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Companies</h1>
          <p className="muted">
            Add each NBFC you&apos;re introducing and fill in its information here. Questions change with the answers, documents upload
            straight into the form, and everything saves as you go. Send it when it&apos;s complete.
          </p>
        </div>
      </div>

      {needsInfo.length > 0 && (
        <div className="note">
          The Before the Bell team has asked for more information on {needsInfo.map((r) => r.companyName).join(", ")}.
        </div>
      )}

      <section className="panel">
        <h2>Add a company</h2>
        <ActionForm action={createSubmissionAction} className="inline">
          <label>
            Company&apos;s legal name
            <input name="companyName" required maxLength={200} placeholder="e.g. Shree Ganesh Fincap Private Limited" />
          </label>
          <Submit>Add and start</Submit>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Your companies</h2>
        {rows.length === 0 ? (
          <div className="empty">No companies yet. Add the first one above.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Still needed</th>
                  <th>Last updated</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/credit/partner/submissions/${r.id}`}>{r.companyName}</Link>
                      {r.cin && <div className="muted small">{r.cin}</div>}
                    </td>
                    <td><Badge status={r.status} label={INTAKE_STATUS_LABEL[r.status]} /></td>
                    <td className="small">
                      {r.status === "draft" || r.status === "needs_info" ? (r.missingCount === 0 ? "Ready to send" : `${r.missingCount} answers or files`) : "—"}
                    </td>
                    <td className="small">{date(r.updatedAt)}</td>
                    <td className="small">{r.submittedAt ? date(r.submittedAt) : "—"}</td>
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
