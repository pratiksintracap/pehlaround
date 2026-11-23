import Link from "next/link";
import { requirePartner } from "@/lib/credit/server/session";
import { getBandForPartner, getMySubmission } from "@/lib/credit/server/intake/partner";
import { formFor, visibleSections, type Answers } from "@/lib/credit/intake/definition";
import { BulkFiles } from "@/components/credit/app/intake/BulkFiles";
import { DataSheetImport } from "@/components/credit/app/intake/DataSheetImport";
import { IntakeForm } from "@/components/credit/app/intake/IntakeForm";
import { AnswersView } from "@/components/credit/app/intake/AnswersView";
import { Badge, date } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { deleteDraftAction } from "../../actions";
import { INTAKE_STATUS_LABEL } from "../../labels";

export default async function PartnerSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const partner = await requirePartner();
  const { id } = await params;
  const { submission: s, files, editable } = await getMySubmission(partner, id);
  const band = await getBandForPartner(partner);
  const sections = formFor(s);
  const fileRefs = files.map((f) => ({ id: f.id, questionKey: f.questionKey, filename: f.filename, sizeBytes: f.sizeBytes }));
  return (
    <>
      <p className="small"><Link href="/credit/partner">← Companies</Link></p>
      <div className="page-head">
        <div>
          <h1>{s.companyName}</h1>
          <p className="muted small">
            Started {date(s.createdAt)}
            {s.submittedAt && <> · sent {date(s.submittedAt)}</>}
          </p>
        </div>
        <Badge status={s.status} label={INTAKE_STATUS_LABEL[s.status]} />
      </div>

      {s.status === "needs_info" && s.teamNote && (
        <div className="note">
          <strong>The Before the Bell team asks:</strong> <span style={{ whiteSpace: "pre-wrap" }}>{s.teamNote}</span>
          <br />Update the answers or files below, then send it again.
        </div>
      )}
      {s.status === "declined" && s.teamNote && <div className="note"><strong>From the Before the Bell team:</strong> {s.teamNote}</div>}
      {!editable && s.status !== "declined" && (
        <div className="note">Sent to the Before the Bell team. It&apos;s locked while they review it; they&apos;ll ask here if they need anything else.</div>
      )}

      {editable ? (
        <>
          <details className="panel shortcuts">
            <summary><strong>Have the company&apos;s data sheet and files already?</strong> Pre-fill the form and upload everything at once</summary>
            <div className="grid2" style={{ marginTop: "0.75rem" }}>
              <div>
                <h3>Pre-fill from the NBFC data sheet (.xlsx)</h3>
                <p className="muted small">Fills only blank answers, from what the sheet states. Check the form afterwards.</p>
                <DataSheetImport submissionApi={`/api/credit/intake/${s.id}`} />
              </div>
              <div>
                <h3>Upload all files</h3>
                <BulkFiles
                  submissionApi={`/api/credit/intake/${s.id}`}
                  fileApi="/api/credit/intake/files"
                  options={visibleSections(sections, s.answers as Answers).flatMap((x) => x.questions).filter((q) => q.field.type === "file" && (q.field.multiple || q.key === "doc_cor")).map((q) => ({ key: q.key, label: q.label }))}
                  existing={fileRefs.map((f) => f.filename)}
                />
              </div>
            </div>
          </details>
          <IntakeForm key={String(s.updatedAt)} id={s.id} sections={sections} initialAnswers={s.answers as Answers} initialFiles={fileRefs} band={band} />
        </>
      ) : (
        <AnswersView sections={sections} answers={s.answers as Answers} files={fileRefs} />
      )}

      {s.status === "draft" && (
        <section className="panel">
          <h2>Delete this draft</h2>
          <ActionForm action={deleteDraftAction} className="inline" confirm={`Delete the draft for ${s.companyName}? Its answers and files will be removed.`}>
            <input type="hidden" name="id" value={s.id} />
            <Submit className="danger">Delete draft</Submit>
          </ActionForm>
        </section>
      )}
    </>
  );
}
