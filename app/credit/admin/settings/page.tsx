import { requireAdmin } from "@/lib/credit/server/session";
import { listReference } from "@/lib/credit/server/admin/reference";
import { listPlatformAdmins } from "@/lib/credit/server/admin/lenders";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { Badge } from "@/components/credit/app/ui";
import {
  addInstrumentAction,
  addChecklistItemAction,
  addSecurityLevelAction,
  addSegmentAction,
  addUserAction,
  removeChecklistItemAction,
  resetTotpAction,
  setUserDisabledAction,
} from "../actions";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [ref, admins] = await Promise.all([listReference(admin), listPlatformAdmins(admin)]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">Lists used across the platform, the default Level 1 checklist, and your team.</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Segments</h2>
          <p className="muted small">Loan-book segments, used for borrower books and lender thesis.</p>
          {ref.segments.length === 0 ? <div className="empty">None yet.</div> : <ul>{ref.segments.map((s) => <li key={s.id}>{s.name}</li>)}</ul>}
          <ActionForm action={addSegmentAction} className="inline">
            <label>Segment<input name="name" required /></label>
            <Submit className="secondary">Add</Submit>
          </ActionForm>
        </section>

        <section className="panel">
          <h2>Security levels</h2>
          <p className="muted small">How secure a raise&apos;s paper is. Lenders pick the levels they take (risk appetite). Lower rank = more secure.</p>
          {ref.securityLevels.length === 0 ? <div className="empty">None yet.</div> : (
            <ul>{ref.securityLevels.map((s) => <li key={s.id}>{s.name} <span className="muted small">(rank {s.rank})</span></li>)}</ul>
          )}
          <ActionForm action={addSecurityLevelAction} className="inline">
            <label>Level<input name="name" required /></label>
            <label style={{ maxWidth: 90 }}>Rank<input name="rank" type="number" min={0} max={100} required defaultValue={ref.securityLevels.length + 1} /></label>
            <Submit className="secondary">Add</Submit>
          </ActionForm>
        </section>
      </div>

      <section className="panel">
        <h2>Instruments</h2>
        <p className="muted small">What a raise can be issued as. Lenders&apos; mandates list the instruments they take, and matching checks it.</p>
        {ref.instruments.length === 0 ? <div className="empty">None yet.</div> : <ul>{ref.instruments.map((s) => <li key={s.id}>{s.name}</li>)}</ul>}
        <ActionForm action={addInstrumentAction} className="inline">
          <label>Instrument<input name="name" required /></label>
          <Submit className="secondary">Add</Submit>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Default Level 1 checklist</h2>
        <p className="muted small">Applied to each new borrower. You can still add items per borrower.</p>
        {ref.checklist.length === 0 ? <div className="empty">The checklist is empty. Add the documents you collect for Level 1 screening.</div> : (
          <table>
            <tbody>
              {ref.checklist.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.title}</strong>{c.description && <div className="small muted">{c.description}</div>}</td>
                  <td style={{ width: 1 }}>
                    <ActionForm action={removeChecklistItemAction} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <Submit className="secondary">Remove</Submit>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ActionForm action={addChecklistItemAction} className="inline">
          <label>Item<input name="title" required /></label>
          <label>Description<input name="description" /></label>
          <Submit className="secondary">Add item</Submit>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Platform team</h2>
        <table>
          <tbody>
            {admins.map((u) => (
              <tr key={u.id}>
                <td>{u.name} {u.disabledAt && <Badge status="inactive" label="Disabled" />}</td>
                <td>{u.email}</td>
                <td>
                  {u.id !== admin.userId && (
                    <div className="inline">
                      <ActionForm action={setUserDisabledAction} className="inline">
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="disable" value={u.disabledAt ? "0" : "1"} />
                        <Submit className="secondary">{u.disabledAt ? "Enable" : "Disable"}</Submit>
                      </ActionForm>
                      <ActionForm action={resetTotpAction} className="inline" confirm="Reset this user's authenticator?">
                        <input type="hidden" name="userId" value={u.id} />
                        <Submit className="secondary">Reset authenticator</Submit>
                      </ActionForm>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ marginTop: "1rem" }}>Add a team member</h3>
        <ActionForm action={addUserAction} className="inline">
          <input type="hidden" name="role" value="platform_admin" />
          <label>Name<input name="name" required /></label>
          <label>Email<input name="email" type="email" required /></label>
          <Submit>Add</Submit>
        </ActionForm>
      </section>
    </>
  );
}
