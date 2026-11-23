import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { importProspectsAction } from "../../actions";

export default async function ImportProspectsPage() {
  await requireAdmin();
  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/credit/admin/prospects">← Prospects</Link></p>
          <h1>Import RBI&apos;s list of NBFCs</h1>
          <p className="muted">
            Upload the CSV made from RBI&apos;s public list of registered NBFCs. Re-import whenever RBI updates the list: details from
            the register are refreshed, and your contacts, statuses and notes are kept.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>Upload</h2>
        <ActionForm action={importProspectsAction}>
          <label>CSV file<input name="file" type="file" accept=".csv,text/csv" required /></label>
          <p className="muted small">
            Columns are matched by name: NBFC name (required), CIN, registration number, regional office, address, email,
            classification and layer. Up to 4 MB per file.
          </p>
          <div><Submit>Import</Submit></div>
        </ActionForm>
      </section>
    </>
  );
}
