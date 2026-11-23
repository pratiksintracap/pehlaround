import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { getTemplate } from "@/lib/credit/server/admin/prospects";
import { fillTemplate, OPT_OUT_TEXT, renderOutreach } from "@/lib/credit/server/prospects/outreach-render";
import { dateTime } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { saveOutreachTemplateAction } from "../../actions";

export default async function OutreachTemplatePage() {
  const admin = await requireAdmin();
  const t = await getTemplate(admin);
  const sample = fillTemplate(t, { company: "Example Finance Ltd", contactName: "Ms Sharma", senderName: admin.name });
  const preview = renderOutreach(sample.body, { senderName: admin.name, replyTo: admin.email });
  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/credit/admin/prospects">← Prospects</Link></p>
          <h1>Outreach template</h1>
          <p className="muted">
            The starting text for every outreach email. You can still edit each email before it goes. Placeholders:{" "}
            <code>{"{{company}}"}</code>, <code>{"{{contact_name}}"}</code> (falls back to &quot;Sir / Madam&quot;),{" "}
            <code>{"{{sender_name}}"}</code>.
          </p>
        </div>
      </div>
      {!t.reviewed && (
        <div className="msg error" style={{ marginBottom: "1rem" }}>
          This is a draft written for you. Read it, change anything you want, and save it. Sending is switched on once it has been saved.
        </div>
      )}
      <div className="grid2">
        <section className="panel">
          <h2>Edit</h2>
          <ActionForm action={saveOutreachTemplateAction}>
            <label>Subject<input name="subject" required defaultValue={t.subject} /></label>
            <label>Message<textarea name="body" rows={18} required defaultValue={t.body} /></label>
            <div><Submit>Save template</Submit></div>
            {t.updatedAt && <p className="muted small">Last saved {dateTime(t.updatedAt)}</p>}
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Preview</h2>
          <p className="muted small">Subject: {sample.subject}</p>
          <div className="preview" dangerouslySetInnerHTML={{ __html: preview.html }} />
          <p className="muted small" style={{ marginTop: "0.5rem" }}>Every email ends with: &quot;{OPT_OUT_TEXT}&quot;</p>
        </section>
      </div>
    </>
  );
}
