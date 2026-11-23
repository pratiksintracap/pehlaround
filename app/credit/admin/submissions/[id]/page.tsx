import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { getSubmission } from "@/lib/credit/server/intake/admin";
import { formFor, type Answers } from "@/lib/credit/intake/definition";
import { AnswersView } from "@/components/credit/app/intake/AnswersView";
import { Badge, date } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { INTAKE_STATUS_LABEL } from "@/app/credit/partner/labels";
import { acceptSubmissionAction, setSubmissionStatusAction } from "../../actions";

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const d = await getSubmission(admin, id);
  const s = d.submission;
  const sections = formFor(s);
  const files = d.files.map((f) => ({ id: f.id, questionKey: f.questionKey, filename: f.filename, sizeBytes: f.sizeBytes }));
  const fmt = (n: number | string) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  const decided = s.status === "accepted";
  return (
    <>
      <p className="small"><Link href="/credit/admin/submissions">← Submissions</Link></p>
      <div className="page-head">
        <div>
          <h1>{s.companyName}</h1>
          <p className="muted small">
            From {d.partnerName} · started {date(s.createdAt)}
            {s.submittedAt && <> · sent {date(s.submittedAt)}</>}
          </p>
        </div>
        <div className="inline">
          {(s.status === "draft" || s.status === "needs_info") && <Link className="button secondary" href={`/credit/admin/submissions/${s.id}/edit`}>Fill in answers and files</Link>}
          {d.inBand === true && <Badge status="approved" label={`AUM ₹${fmt(d.aum!)} Cr · in band`} />}
          {d.inBand === false && <Badge status="in_review" label={`AUM ₹${fmt(d.aum!)} Cr · outside ₹${fmt(d.band.minCr)}–${fmt(d.band.maxCr)} Cr`} />}
          <Badge status={s.status} label={INTAKE_STATUS_LABEL[s.status]} />
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <h2>Checks</h2>
          <dl className="facts">
            {s.source === "public" && (
              <>
                <dt>Filled by</dt>
                <dd>
                  {s.submitterName} · {s.submitterRole === "agent" ? `agent${s.agentFirm ? `, ${s.agentFirm}` : ""}` : "the company"}
                  <div className="small">
                    {s.submitterEmail && <a href={`mailto:${s.submitterEmail}`}>{s.submitterEmail}</a>}
                    {s.submitterPhone && <> · {s.submitterPhone}</>}
                  </div>
                  <div className="muted small">From the website, no account. Privacy consent {s.consentNoticeVersion} on {s.consentedAt ? date(s.consentedAt) : "—"}.</div>
                </dd>
              </>
            )}
            <dt>RBI register</dt>
            <dd>
              {d.registry ? (
                <>
                  Found: <Link href={`/credit/admin/prospects/${d.registry.id}`}>{d.registry.name}</Link>
                  <div className="muted small">{[d.registry.layer, d.registry.classification, d.registry.regionalOffice && `RBI ${d.registry.regionalOffice}`].filter(Boolean).join(" · ")}</div>
                </>
              ) : s.cin ? (
                <span style={{ color: "var(--bad)" }}>No NBFC with CIN {s.cin} in the imported RBI list</span>
              ) : (
                <span className="muted">No CIN given</span>
              )}
            </dd>
            <dt>Required items</dt>
            <dd>{d.missing.length === 0 ? "All answered" : <>{d.missing.length} missing</>}</dd>
            <dt>Files</dt>
            <dd>{d.files.length}</dd>
            {s.borrowerId && (
              <>
                <dt>Borrower</dt>
                <dd><Link href={`/credit/admin/borrowers/${s.borrowerId}`}>Open borrower record</Link></dd>
              </>
            )}
          </dl>
          {d.missing.length > 0 && (
            <details className="history" style={{ marginTop: "0.6rem" }}>
              <summary>What&apos;s missing</summary>
              <ul className="small">{d.missing.map((m) => <li key={m.key}>{m.section}: {m.label}</li>)}</ul>
            </details>
          )}
        </section>

        <section className="panel">
          <h2>Decision</h2>
          {decided ? (
            <p className="small">Accepted. The borrower record has this company&apos;s details, latest quarter figures and every file.</p>
          ) : s.status === "draft" ? (
            <p className="small muted">The partner is still filling this in. You can look, but it can&apos;t be reviewed until they send it.</p>
          ) : (
            <>
              <ActionForm action={acceptSubmissionAction} confirm={`Create a borrower record for ${s.companyName} with these details and files?`}>
                <input type="hidden" name="id" value={s.id} />
                <p className="small muted" style={{ margin: 0 }}>
                  Creates the borrower (status: onboarding) with its details, drawdown cycle, latest quarter AUM / GNPA / leverage and all
                  {" "}{d.files.length} files, and links it to the RBI-register prospect.
                </p>
                <div><Submit>Accept and create borrower</Submit></div>
              </ActionForm>
              <hr className="rule" />
              <ActionForm action={setSubmissionStatusAction}>
                <input type="hidden" name="id" value={s.id} />
                <label>
                  Note to the partner
                  <textarea name="note" maxLength={4000} defaultValue={s.status === "needs_info" ? s.teamNote ?? "" : ""} placeholder="e.g. Please add the March 2026 ALM and the lender-wise borrowing list" />
                </label>
                <div className="inline">
                  <button type="submit" name="status" value="needs_info">Ask for more information</button>
                  <button type="submit" name="status" value="in_review" className="secondary">Mark in review</button>
                  <button type="submit" name="status" value="declined" className="danger">Not taking forward</button>
                </div>
                <p className="muted small" style={{ margin: 0 }}>
                  Asking for more information unlocks the form, shows your note there and emails {s.source === "public" ? "the person who filled it their private link" : "the partner a sign-in link"} (no details in the email).
                </p>
              </ActionForm>
            </>
          )}
        </section>
      </div>

      <AnswersView sections={sections} answers={s.answers as Answers} files={files} />
    </>
  );
}
