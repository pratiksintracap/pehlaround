import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { getSubmission } from "@/lib/credit/server/intake/admin";
import { getBandForPartner } from "@/lib/credit/server/intake/partner";
import { formFor, visibleSections, type Answers } from "@/lib/credit/intake/definition";
import { IntakeForm } from "@/components/credit/app/intake/IntakeForm";
import { BulkFiles } from "@/components/credit/app/intake/BulkFiles";
import { DataSheetImport } from "@/components/credit/app/intake/DataSheetImport";

export const metadata = { title: "Fill in for a partner" };

export default async function EditSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const d = await getSubmission(admin, id);
  const s = d.submission;
  const sections = formFor(s);
  const band = await getBandForPartner(admin);
  const files = d.files.map((f) => ({ id: f.id, questionKey: f.questionKey, filename: f.filename, sizeBytes: f.sizeBytes }));
  const editable = s.status === "draft" || s.status === "needs_info";
  const fileOptions = visibleSections(sections, s.answers as Answers)
    .flatMap((x) => x.questions)
    .filter((q) => q.field.type === "file" && (q.field.multiple || q.key === "doc_cor"))
    .map((q) => ({ key: q.key, label: q.label }));
  const api = `/api/credit/intake/${s.id}`;
  return (
    <>
      <p className="small"><Link href={`/credit/admin/submissions/${s.id}`}>← Back to the review page</Link></p>
      <div className="page-head">
        <div>
          <h1>{s.companyName}</h1>
          <p className="muted small">Filling in for {d.partnerName}. Answers save as you type; the partner sees the same form if they sign in.</p>
        </div>
      </div>
      {!editable ? (
        <div className="note">This company has been sent ({s.status.replace("_", " ")}). Ask for more information on the review page to reopen it.</div>
      ) : (
        <>
          <div className="grid2">
            <section className="panel">
              <h2>1. Pre-fill from their data sheet</h2>
              <p className="muted small">
                The NBFC data workbook (tabs like Company, Operations, Debt Profile, CER, ALM). Only blank answers are filled; nothing is
                estimated, so anything the sheet doesn&apos;t state stays blank.
              </p>
              <DataSheetImport submissionApi={api} />
            </section>
            <section className="panel">
              <h2>2. Add all their files</h2>
              <BulkFiles submissionApi={api} fileApi="/api/credit/intake/files" options={fileOptions} existing={files.map((f) => f.filename)} />
            </section>
          </div>
          <h2 style={{ marginTop: "1.5rem" }}>3. Check and complete the form</h2>
          <IntakeForm key={String(s.updatedAt)} id={s.id} sections={sections} initialAnswers={s.answers as Answers} initialFiles={files} band={band} submissionApi={api} fileApi="/api/credit/intake/files" />
        </>
      )}
    </>
  );
}
