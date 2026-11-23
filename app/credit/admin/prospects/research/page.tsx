import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { importResearchAction } from "../../actions";

const HEADER = "name,cin,type,agency,rating,outlook,rating_date,aum_cr,aum_as_of,loan_book_cr,gnpa_pct,crar_pct,bank_facilities_cr,lenders,state,source_url,notes";

export default async function ImportResearchPage() {
  await requireAdmin();
  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/credit/admin/prospects">← Prospects</Link></p>
          <h1>Import research</h1>
          <p className="muted">
            Ratings, size, asset quality and current lenders for NBFCs, from rating reports or company filings. Each row is matched to
            an NBFC in RBI&apos;s list by CIN, or else by name. Research fields are replaced; AUM is updated when the row&apos;s figure is newer
            than the one on file.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>Upload or paste</h2>
        <ActionForm action={importResearchAction}>
          <label>CSV file<input name="file" type="file" accept=".csv,text/csv" /></label>
          <label>…or paste the CSV<textarea name="csv" rows={10} placeholder={HEADER} style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8rem" }} /></label>
          <p className="muted small">
            Columns (any order, matched by name): <code>{HEADER}</code>. Also accepted: charges_total_cr, directors, last_filing_on, website.
            Amounts in ₹ crore, percentages as numbers, dates as YYYY-MM-DD, lenders separated by semicolons.
          </p>
          <div><Submit>Import</Submit></div>
        </ActionForm>
      </section>
    </>
  );
}
