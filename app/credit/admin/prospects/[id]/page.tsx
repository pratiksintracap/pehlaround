import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { getProspect, OUTREACH_FROM_ADDRESS } from "@/lib/credit/server/admin/prospects";
import { fillTemplate } from "@/lib/credit/server/prospects/outreach-render";
import { inSendWindow } from "@/lib/credit/server/prospects/send-window";
import { Badge, dateTime } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { convertProspectAction, sendOutreachAction, updateProspectAction, updateProspectResearchAction } from "../../actions";
import { priorityScore } from "@/lib/credit/server/prospects/classify";
import { PROSPECT_STATUS_LABEL, PROSPECT_STATUS_ORDER } from "../labels";
import { crore } from "../format";

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { prospect: p, emails, template, band } = await getProspect(admin, id);
  const size = p.aumCr ?? p.loanBookCr;
  const inBand = size != null && Number(size) >= Number(band.minCr) && Number(size) <= Number(band.maxCr);
  const pr = priorityScore(
    {
      sizeCr: size == null ? null : Number(size),
      ratingGrade: p.ratingGrade,
      rating: p.rating,
      ratingOutlook: p.ratingOutlook,
      lenderCount: p.lenders?.length ?? 0,
      contactName: p.contactName,
      contactEmail: p.contactEmail,
      registeredEmail: p.registeredEmail,
      status: p.status,
    },
    { minCr: Number(band.minCr), maxCr: Number(band.maxCr) },
  );
  const draft = fillTemplate(template, { company: p.name, contactName: p.contactName, senderName: admin.name });
  const to = p.contactEmail ?? p.registeredEmail ?? "";
  const blocked = p.status === "do_not_contact";

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/credit/admin/prospects">← Prospects</Link></p>
          <h1>{p.name}</h1>
          <p className="muted">
            {[p.layer, p.classification, p.state, p.regionalOffice && `RBI ${p.regionalOffice}`].filter(Boolean).join(" · ") || "From RBI's register"}
          </p>
        </div>
        <div className="inline">
          {size == null ? (
            <Badge status="idle" label="Size unknown" />
          ) : inBand ? (
            <Badge status="approved" label={`In band (₹${crore(band.minCr)}–${crore(band.maxCr)} Cr)`} />
          ) : (
            <Badge status="rejected" label={`Outside band (₹${crore(band.minCr)}–${crore(band.maxCr)} Cr)`} />
          )}
          <Badge status={p.status} label={PROSPECT_STATUS_LABEL[p.status]} />
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <h2>From RBI&apos;s register</h2>
          <dl className="facts">
            <dt>CIN</dt><dd>{p.cin ?? "—"}</dd>
            <dt>RBI registration</dt><dd>{p.rbiRegNo ?? "—"}</dd>
            <dt>Address</dt><dd>{p.address ?? "—"}</dd>
            <dt>Registered email</dt><dd>{p.registeredEmail ? <a href={`mailto:${p.registeredEmail}`}>{p.registeredEmail}</a> : "—"}</dd>
            <dt>Last seen in import</dt><dd>{p.lastSeenInImportAt ? dateTime(p.lastSeenInImportAt) : "—"}</dd>
          </dl>
          {p.borrowerId ? (
            <p style={{ marginTop: "1rem" }}><Link href={`/credit/admin/borrowers/${p.borrowerId}`}>Open borrower record</Link></p>
          ) : (
            <ActionForm action={convertProspectAction} className="inline" confirm={`Create a borrower record for ${p.name}?`}>
              <input type="hidden" name="id" value={p.id} />
              <Submit className="secondary">Onboard as borrower</Submit>
            </ActionForm>
          )}
        </section>

        <section className="panel">
          <h2>Size, contact and status</h2>
          <ActionForm action={updateProspectAction}>
            <input type="hidden" name="id" value={p.id} />
            <div className="inline">
              <label>Loan book (₹ Cr)<input name="loanBookCr" inputMode="decimal" defaultValue={crore(p.loanBookCr)} /></label>
              <label>AUM (₹ Cr)<input name="aumCr" inputMode="decimal" defaultValue={crore(p.aumCr)} /></label>
            </div>
            <div className="inline">
              <label>Size as of<input name="sizeAsOf" type="date" defaultValue={p.sizeAsOf ?? ""} /></label>
              <label>Source<input name="sizeSource" defaultValue={p.sizeSource ?? ""} placeholder="e.g. rating note, annual report" /></label>
            </div>
            <div className="inline">
              <label>Contact name<input name="contactName" defaultValue={p.contactName ?? ""} /></label>
              <label>Role<input name="contactRole" defaultValue={p.contactRole ?? ""} placeholder="CFO, Treasury head" /></label>
            </div>
            <div className="inline">
              <label>Contact email<input name="contactEmail" type="email" defaultValue={p.contactEmail ?? ""} /></label>
              <label>Phone<input name="contactPhone" defaultValue={p.contactPhone ?? ""} /></label>
            </div>
            <div className="inline">
              <label>
                Status
                <select name="status" defaultValue={p.status}>
                  {PROSPECT_STATUS_ORDER.map((s) => <option key={s} value={s}>{PROSPECT_STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              <label>Next follow-up<input name="nextFollowUp" type="date" defaultValue={p.nextFollowUp ?? ""} /></label>
            </div>
            <label>Notes<textarea name="notes" rows={4} defaultValue={p.notes ?? ""} /></label>
            <div><Submit>Save</Submit></div>
          </ActionForm>
        </section>
      </div>

      <section className="panel">
        <h2>
          Research
          <span className={`score ${pr >= 60 ? "hi" : pr >= 40 ? "mid" : ""}`} style={{ marginLeft: "0.6rem" }} title="Priority, 0–100: see the Prospects list for how it's worked out">
            Priority {pr}
          </span>
        </h2>
        {p.ratingUrl && (
          <p className="small">
            Latest rating report: <a href={p.ratingUrl} target="_blank" rel="noreferrer">{p.ratingAgency ?? "source"}{p.ratingDate ? `, ${p.ratingDate}` : ""}</a>
            {p.researchedAt && <span className="muted"> · updated {dateTime(p.researchedAt)}</span>}
          </p>
        )}
        <ActionForm action={updateProspectResearchAction}>
          <input type="hidden" name="id" value={p.id} />
          <div className="row">
            <label>Rating agency<input name="ratingAgency" defaultValue={p.ratingAgency ?? ""} placeholder="e.g. Acuité" /></label>
            <label>Rating<input name="rating" defaultValue={p.rating ?? ""} placeholder="e.g. ACUITE BBB-" /></label>
            <label>Outlook<input name="ratingOutlook" defaultValue={p.ratingOutlook ?? ""} placeholder="Stable / Negative / INC" /></label>
            <label>Rating date<input name="ratingDate" type="date" defaultValue={p.ratingDate ?? ""} /></label>
          </div>
          <label>Rating report link<input name="ratingUrl" defaultValue={p.ratingUrl ?? ""} placeholder="https://" /></label>
          <div className="row">
            <label>Gross NPA (%)<input name="gnpaPct" inputMode="decimal" defaultValue={p.gnpaPct ?? ""} /></label>
            <label>CRAR (%)<input name="crarPct" inputMode="decimal" defaultValue={p.crarPct ?? ""} /></label>
            <label>Rated facilities (₹ Cr)<input name="bankFacilitiesCr" inputMode="decimal" defaultValue={p.bankFacilitiesCr ?? ""} /></label>
            <label>Registered charges (₹ Cr)<input name="chargesTotalCr" inputMode="decimal" defaultValue={p.chargesTotalCr ?? ""} /></label>
          </div>
          <label>Current lenders (one per line)<textarea name="lenders" rows={4} defaultValue={(p.lenders ?? []).join("\n")} /></label>
          <div className="row">
            <label>Segment<input name="segment" defaultValue={p.segment ?? ""} placeholder="e.g. MSME, Microfinance" /></label>
            <label>Website<input name="website" defaultValue={p.website ?? ""} placeholder="https://" /></label>
            <label>Last annual filing<input name="lastFilingOn" type="date" defaultValue={p.lastFilingOn ?? ""} /></label>
          </div>
          <label>Directors<textarea name="directors" rows={2} defaultValue={p.directors ?? ""} /></label>
          <label>Research notes<textarea name="researchNotes" rows={3} defaultValue={p.researchNotes ?? ""} /></label>
          <div><Submit className="secondary">Save research</Submit></div>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Send outreach</h2>
        {blocked ? (
          <div className="empty">This NBFC is marked do not contact.</div>
        ) : !template.reviewed ? (
          <div className="msg error">
            Review the outreach template before the first send: <Link href="/credit/admin/prospects/template">open the template</Link>.
          </div>
        ) : (
          <>
            <p className="muted small">
              Sent from {admin.name} | Before the Bell &lt;{OUTREACH_FROM_ADDRESS}&gt;; replies go to {admin.email}. Written from the template,
              so edit freely before sending. Nothing is sent until you click Send.
            </p>
            {!inSendWindow(new Date()) && (
              <div className="msg error" style={{ marginBottom: "0.75rem" }}>
                Outreach can be sent between 9:00 and 20:00 IST. You can prepare the email now and send it then.
              </div>
            )}
            <ActionForm action={sendOutreachAction} confirm={`Send this email to ${p.name} now?`}>
              <input type="hidden" name="id" value={p.id} />
              <label>To<input name="to" type="email" required defaultValue={to} /></label>
              <label>Subject<input name="subject" required defaultValue={draft.subject} /></label>
              <label>Message<textarea name="body" rows={14} required defaultValue={draft.body} /></label>
              <p className="muted small">A signature (your name, Before the Bell, beforethebell.in, your email) and an opt-out line are added automatically.</p>
              <div><Submit>Send email</Submit></div>
            </ActionForm>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Outreach history</h2>
        {emails.length === 0 ? (
          <div className="empty">Nothing sent yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <td className="small">{dateTime(e.sentAt ?? e.scheduledFor)}</td>
                    <td className="small">{e.toEmail}</td>
                    <td>
                      <details>
                        <summary>{e.subject}</summary>
                        <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{e.bodyText}</pre>
                      </details>
                    </td>
                    <td>
                      <Badge status={e.status === "sent" ? "approved" : e.status === "failed" ? "rejected" : "idle"} label={e.status[0].toUpperCase() + e.status.slice(1)} />
                      {e.error && <div className="small muted">{e.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
