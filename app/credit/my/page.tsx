import Link from "next/link";
import { requireApplicantUser } from "@/lib/credit/server/session";
import { listMyForms } from "@/lib/credit/server/intake/public";

export const metadata = { title: "Your forms · Before the Bell" };

const STATUS: Record<string, string> = {
  draft: "In progress",
  submitted: "Sent, with the team",
  in_review: "Being reviewed",
  needs_info: "The team has asked for more",
  accepted: "Taken forward",
  declined: "Not taken forward",
};

const day = (d: Date | string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function MyForms() {
  const me = await requireApplicantUser();
  const forms = await listMyForms(me);
  return (
    <div className="my">
      <h1>Your forms</h1>
      <p className="lede">Signed in as {me.email}. Open a form to carry on where you left off.</p>
      {forms.length === 0 ? (
        <div className="sheet">
          <p>There are no forms under this email yet.</p>
          <Link className="button" href="/credit/apply">Start a form</Link>
        </div>
      ) : (
        <ul className="form-list">
          {forms.map((f) => (
            <li key={f.id}>
              <div>
                <strong>{f.companyName}</strong>
                <span className={`state s-${f.status}`}>{STATUS[f.status] ?? f.status}</span>
              </div>
              <span className="muted small">{f.submittedAt ? `Sent ${day(f.submittedAt)}` : `Last saved ${day(f.updatedAt)}`}</span>
              {f.token ? (
                <Link className="button secondary" href={`/credit/apply/${f.token}`}>
                  {f.status === "draft" || f.status === "needs_info" ? "Continue" : "View"}
                </Link>
              ) : (
                <span className="muted small">Use the link in your email</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small"><Link href="/credit/apply">Start a form for another NBFC</Link></p>
    </div>
  );
}
