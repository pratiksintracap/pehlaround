import { requireAdmin } from "@/lib/credit/server/session";
import { listAccessRequests } from "@/lib/credit/server/admin/overview";
import { Badge, dateTime } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { eraseAccessRequestAction, setAccessRequestStatusAction } from "../actions";

export default async function AccessRequestsPage() {
  const admin = await requireAdmin();
  const rows = await listAccessRequests(admin);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Access requests</h1>
          <p className="muted">Submitted from the public site. Approving here only tracks status: create the borrower or lender and their users yourself. Erase a request when the person withdraws consent or it&apos;s no longer needed.</p>
        </div>
      </div>
      <section className="panel">
        {rows.length === 0 ? <div className="empty">No requests yet.</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Received</th><th>Side</th><th>Organisation</th><th>Contact</th><th>Message</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="small">{dateTime(r.createdAt)}</td>
                    <td>{r.side === "borrower" ? "Borrower" : "Lender"}</td>
                    <td>{r.organisation}</td>
                    <td className="small">{r.name}<div><a href={`mailto:${r.email}`}>{r.email}</a></div>{r.phone && <div>{r.phone}</div>}</td>
                    <td className="small">{r.message ?? "—"}<div className="muted">Consent: {r.consentedAt ? `notice ${r.consentNoticeVersion}, ${dateTime(r.consentedAt)}` : "not recorded"}</div></td>
                    <td>
                      <Badge status={r.status} />
                      <ActionForm action={setAccessRequestStatusAction} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <select name="status" defaultValue={r.status} aria-label="Request status">
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="approved">Approved</option>
                          <option value="declined">Declined</option>
                        </select>
                        <Submit className="secondary">Update</Submit>
                      </ActionForm>
                      <ActionForm action={eraseAccessRequestAction} className="inline" confirm="Permanently erase this request and its personal data?">
                        <input type="hidden" name="id" value={r.id} />
                        <Submit className="danger">Erase</Submit>
                      </ActionForm>
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
