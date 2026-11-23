import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listPartners } from "@/lib/credit/server/intake/admin";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { addPartnerUserAction, createPartnerAction } from "../actions";

export default async function PartnersPage() {
  const admin = await requireAdmin();
  const partners = await listPartners(admin);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Partners</h1>
          <p className="muted">
            Aggregators who introduce borrower NBFCs. Each person you add signs in with their email and sees only the companies their firm
            has added. They fill each company&apos;s information form; you review it under <Link href="/credit/admin/submissions">Submissions</Link>.
          </p>
        </div>
      </div>

      {partners.map((p) => (
        <section className="panel" key={p.id}>
          <h2>
            {p.name}
            {p.city && <span className="muted small"> · {p.city}</span>}
          </h2>
          <p className="small">
            <Link href={`/credit/admin/submissions?partner=${p.id}`}>{p.submissions} sent</Link>
            <span className="muted"> · {p.drafts} in progress</span>
          </p>
          {p.notes && <p className="muted small" style={{ whiteSpace: "pre-wrap" }}>{p.notes}</p>}
          {p.users.length > 0 ? (
            <ul className="plain">
              {p.users.map((u) => (
                <li key={u.id}>
                  {u.name} <span className="muted small">{u.email}{u.disabledAt ? " · disabled" : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No one can sign in for this partner yet.</p>
          )}
          <ActionForm action={addPartnerUserAction} className="inline">
            <input type="hidden" name="partnerId" value={p.id} />
            <label>Name<input name="name" required maxLength={200} /></label>
            <label>Email<input name="email" type="email" required maxLength={200} /></label>
            <Submit className="secondary">Add person</Submit>
          </ActionForm>
        </section>
      ))}

      <section className="panel">
        <h2>Add a partner</h2>
        <ActionForm action={createPartnerAction}>
          <div className="row">
            <label>Firm name<input name="name" required maxLength={200} placeholder="Firm name" /></label>
            <label>City<input name="city" maxLength={100} /></label>
          </div>
          <label>Notes (team only)<textarea name="notes" maxLength={2000} /></label>
          <div><Submit>Add partner</Submit></div>
        </ActionForm>
      </section>
    </>
  );
}
