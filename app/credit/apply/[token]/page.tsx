import Link from "next/link";
import { notFound } from "next/navigation";
import { applicantFor } from "@/lib/credit/server/intake/public";
import { submissionIdFor } from "@/lib/credit/server/intake/public-forms";
import { getBandForPartner, getMySubmission } from "@/lib/credit/server/intake/partner";
import { NotFoundError } from "@/lib/credit/server/actors";
import { currentActor } from "@/lib/credit/server/session";
import { formFor, type Answers } from "@/lib/credit/intake/definition";
import { IntakeForm } from "@/components/credit/app/intake/IntakeForm";
import { AnswersView } from "@/components/credit/app/intake/AnswersView";

export const metadata = { title: "Borrower form · Before the Bell" };

export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ new?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const who = applicantFor(token);
  if (!who) notFound();
  let d;
  try {
    d = await getMySubmission(who, await submissionIdFor(who));
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const s = d.submission;
  const band = await getBandForPartner(who);
  const sections = formFor(s);
  const files = d.files.map((f) => ({ id: f.id, questionKey: f.questionKey, filename: f.filename, sizeBytes: f.sizeBytes }));
  const fileApi = `/api/credit/apply/${token}/files`;
  const signedIn = (await currentActor())?.kind === "applicant_user";
  return (
    <div className="apply-form">
      <div className="form-head">
        <h1>{s.companyName}</h1>
        <p className="muted">
          {s.submitterName ? `Filled in by ${s.submitterName}` : "Borrower form"}
          {s.submittedAt ? `, sent ${new Date(s.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
        </p>
      </div>
      {sp.new && d.editable && (
        <div className="welcome" role="status">
          <strong>You&apos;re set up.</strong> We&apos;ve emailed a link back to this form{s.submitterEmail ? ` to ${s.submitterEmail}` : ""}, and you
          can also sign in with that email any time to see your forms. Fill in what you have; only a few answers are needed to send it.
        </div>
      )}
      {s.status === "needs_info" && s.teamNote && (
        <div className="note">
          <strong>The Before the Bell team asks:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{s.teamNote}</span>
          <br />Update the answers or files, then send it again.
        </div>
      )}
      {!d.editable && (
        <div className="note">
          {s.status === "declined"
            ? <>The Before the Bell team isn&apos;t taking this forward for now.{s.teamNote ? ` ${s.teamNote}` : ""}</>
            : <>Thank you. The form is with the Before the Bell team. They&apos;ll be in touch, and if they need anything else they&apos;ll reopen it here.</>}
        </div>
      )}
      {d.editable ? (
        <IntakeForm id={s.id} sections={sections} initialAnswers={s.answers as Answers} initialFiles={files} band={band} submissionApi={`/api/credit/apply/${token}`} fileApi={fileApi} />
      ) : (
        <AnswersView sections={sections} answers={s.answers as Answers} files={files} fileApi={fileApi} />
      )}
      <p className="muted small form-foot">
        Keep this page&apos;s link private: anyone with it can open the form.{" "}
        {signedIn ? <Link href="/credit/my">Your forms</Link> : <Link href="/credit/login">Sign in to see all your forms</Link>}
        {" · "}<Link href="/credit/apply">Start a form for another NBFC</Link>
      </p>
    </div>
  );
}
