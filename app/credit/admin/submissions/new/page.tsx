import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listPartners } from "@/lib/credit/server/intake/admin";
import { NewSubmissionForm } from "./NewSubmissionForm";

export const metadata = { title: "Add a company for a partner" };

export default async function NewSubmissionPage() {
  const admin = await requireAdmin();
  const partners = await listPartners(admin);
  return (
    <>
      <p className="small"><Link href="/credit/admin/submissions">← Submissions</Link></p>
      <div className="page-head">
        <div>
          <h1>Add a company for a partner</h1>
          <p className="muted">
            For when a partner sends the files by email instead of filling the form. The company is filed under that partner, just as if
            they had started it. Next you can pre-fill it from their data sheet and drop in all their files, ZIPs included.
          </p>
        </div>
      </div>
      <section className="panel" style={{ maxWidth: 720 }}>
        <NewSubmissionForm partners={partners.map((p) => ({ id: p.id, name: p.name }))} />
      </section>
    </>
  );
}
