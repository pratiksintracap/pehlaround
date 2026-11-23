import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/credit/server/session";
import { getLender } from "@/lib/credit/server/admin/lenders";
import { listReference } from "@/lib/credit/server/admin/reference";
import { NotFoundError } from "@/lib/credit/server/actors";
import { Badge, dateTime, inr } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { addUserAction, resetTotpAction, setUserDisabledAction, updateLenderAction } from "../../actions";
import { LenderFields } from "../LenderFields";

export default async function LenderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const d = await getLender(admin, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const ref = await listReference(admin);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/credit/admin/lenders">Lenders</Link></p>
          <h1>{d.lender.name}</h1>
          {!d.lender.active && <Badge status="inactive" />}
        </div>
        <Link className="button secondary" href={`/credit/admin/activity?entity=lender&id=${d.lender.id}`}>Activity</Link>
      </div>

      <section className="panel">
        <h2>Exposure</h2>
        <p className="muted small">Measured on amount outstanding (disbursed minus repaid) across raises on the platform, by the segment each raise funds.</p>
        <div className="grid-3" style={{ marginBottom: "0.75rem" }}>
          <div className="stat"><span className="muted small">Outstanding</span><strong>{inr(d.exposure.totalOutstanding)}</strong></div>
          <div className="stat"><span className="muted small">Disbursed to date</span><strong>{inr(d.exposure.totalDisbursed)}</strong></div>
        </div>
        {d.exposure.bySegment.length === 0 ? (
          <div className="empty">No targets set and nothing disbursed yet.</div>
        ) : (
          <table>
            <thead><tr><th>Segment</th><th className="num">Target</th><th className="num">Outstanding</th><th className="num">Headroom</th><th className="num">Disbursed</th></tr></thead>
            <tbody>
              {d.exposure.bySegment.map((s) => (
                <tr key={s.segmentId ?? "none"}>
                  <td>{s.segment}</td>
                  <td className="num">{inr(s.target)}</td>
                  <td className="num">{inr(s.outstanding)}</td>
                  <td className="num">{s.headroom != null ? <span style={{ color: Number(s.headroom) <= 0 ? "var(--bad)" : undefined }}>{inr(s.headroom)}</span> : "—"}</td>
                  <td className="num">{inr(s.disbursed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Lender profile</h2>
        <ActionForm action={updateLenderAction}>
          <input type="hidden" name="id" value={d.lender.id} />
          <LenderFields segments={ref.segments} securityLevels={ref.securityLevels} instruments={ref.instruments} instrumentIds={d.instrumentIds} l={d.lender} targets={d.targets} securityLevelIds={d.securityLevelIds} />
          <div><Submit>Save profile</Submit></div>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Team</h2>
        <p className="muted small">Lender admins can act (Level 2 status, indicate interest). Viewers can only look. Everyone signs in with a one-time code sent to their work email.</p>
        {d.team.length === 0 ? (
          <div className="empty">No users yet. Add the lender&apos;s first user below.</div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Authenticator</th><th></th></tr></thead>
            <tbody>
              {d.team.map((u) => (
                <tr key={u.id}>
                  <td>{u.name} {u.disabledAt && <Badge status="inactive" label="Disabled" />}</td>
                  <td>{u.email}</td>
                  <td>{u.role === "lender_admin" ? "Admin" : "Viewer"}</td>
                  <td className="small">{u.totpEnabledAt ? `Set up ${dateTime(u.totpEnabledAt)}` : "Not set up yet"}</td>
                  <td>
                    <div className="inline">
                      <ActionForm action={setUserDisabledAction} className="inline">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="disable" value={u.disabledAt ? "0" : "1"} />
                        <Submit className="secondary">{u.disabledAt ? "Enable" : "Disable"}</Submit>
                      </ActionForm>
                      {u.totpEnabledAt && (
                        <ActionForm action={resetTotpAction} className="inline" confirm="Reset this user's authenticator?">
                          <input type="hidden" name="userId" value={u.id} />
                          <Submit className="secondary">Reset authenticator</Submit>
                        </ActionForm>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h3 style={{ marginTop: "1rem" }}>Add a user</h3>
        <ActionForm action={addUserAction} className="inline">
          <input type="hidden" name="lenderId" value={d.lender.id} />
          <label>Name<input name="name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <label>
            Role
            <select name="role" defaultValue="lender_viewer">
              <option value="lender_admin">Admin (can act)</option>
              <option value="lender_viewer">Viewer (read only)</option>
            </select>
          </label>
          <Submit>Add user</Submit>
        </ActionForm>
      </section>
    </>
  );
}
