import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/credit/server/session";
import { getBorrower } from "@/lib/credit/server/admin/borrowers";
import { listReference } from "@/lib/credit/server/admin/reference";
import { listLenders } from "@/lib/credit/server/admin/lenders";
import { listFinancials, financialsBehind, lastQuarterEnd } from "@/lib/credit/server/admin/financials";
import { NotFoundError } from "@/lib/credit/server/actors";
import { effectiveL1Status, L1_REFRESH_MONTHS } from "@/lib/credit/server/diligence-rules";
import { Badge, cycleLabel, cycleName, date, dateTime, inr, pct } from "@/components/credit/app/ui";
import { nextCycleStart, normaliseCycleStart } from "@/lib/credit/server/cycles";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import {
  addItemAction,
  createRaiseAction,
  repeatRaiseAction,
  setItemStatusAction,
  setL1Action,
  setL2AsAdminAction,
  updateBorrowerAction,
  uploadDocumentAction,
  saveFinancialsAction,
} from "../../actions";
import { BorrowerFields } from "../BorrowerFields";
import { RaiseFields } from "../../raises/RaiseFields";

export default async function BorrowerPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const data = await getBorrower(admin, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [ref, lenders, financials] = await Promise.all([listReference(admin), listLenders(admin), listFinancials(admin, id)]);
  const { borrower: b, l1, l1History, items, docs, segmentIds, l2, raises } = data;
  const l1Status = effectiveL1Status(l1);
  const latest = raises[0];
  // Default start for a new raise: right after the latest raise's period, else next calendar month.
  const now = new Date();
  const nextStart = latest
    ? nextCycleStart(latest.cycleStart, latest.cycle)
    : normaliseCycleStart(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/credit/admin/borrowers">Borrowers</Link></p>
          <h1>{b.name}</h1>
          <p className="muted">
            Level 1 <Badge status={l1Status} /> {l1?.refreshDueAt && <span className="small">· refresh due {date(l1.refreshDueAt)}</span>}
          </p>
        </div>
      </div>

      {/* ---------- Level 1 ---------- */}
      <section className="panel">
        <h2>Level 1 diligence (platform screening)</h2>
        <p className="muted small">
          Collect and review each item here. Approving baselines Level 1 for {L1_REFRESH_MONTHS} months; mark a material change to require a
          refresh sooner. Lenders on a shared raise see each item&apos;s title, status and files, not your review notes.
        </p>
        {items.length === 0 ? (
          <div className="empty">No checklist items yet. Add the items you need from this borrower below.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th>Status</th><th>Files</th><th>Review</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <strong>{it.title}</strong>
                      {it.description && <div className="small muted">{it.description}</div>}
                    </td>
                    <td><Badge status={it.status} />{it.reviewedAt && <div className="small muted">{dateTime(it.reviewedAt)}</div>}</td>
                    <td>
                      {docs.filter((d) => d.diligenceItemId === it.id && !d.supersededAt).map((d) => (
                        <div key={d.id} className="small"><a href={`/api/credit/documents/${d.id}`}>{d.filename}</a></div>
                      ))}
                      {docs.some((d) => d.diligenceItemId === it.id && d.supersededAt) && (
                        <details className="history small">
                          <summary>Earlier versions</summary>
                          {docs.filter((d) => d.diligenceItemId === it.id && d.supersededAt).map((d) => (
                            <div key={d.id}><a className="earlier" href={`/api/credit/documents/${d.id}`}>{d.filename}</a> <span className="muted">replaced {date(d.supersededAt)}</span></div>
                          ))}
                        </details>
                      )}
                      <ActionForm action={uploadDocumentAction} className="stack">
                        <input type="hidden" name="borrowerId" value={b.id} />
                        <input type="hidden" name="itemId" value={it.id} />
                        <input type="file" name="file" required aria-label={`Upload file for ${it.title}`} />
                        {docs.some((d) => d.diligenceItemId === it.id && !d.supersededAt) && (
                          <label className="check small"><input type="checkbox" name="replaces" defaultChecked /> Replaces the current file(s)</label>
                        )}
                        <div><Submit className="secondary">Upload</Submit></div>
                      </ActionForm>
                    </td>
                    <td>
                      <ActionForm action={setItemStatusAction} className="stack">
                        <input type="hidden" name="borrowerId" value={b.id} />
                        <input type="hidden" name="itemId" value={it.id} />
                        <select name="status" defaultValue={it.status} aria-label="Item status">
                          <option value="pending">Pending</option>
                          <option value="received">Received</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <input name="note" placeholder="Review note (internal)" defaultValue={it.reviewNote ?? ""} />
                        <Submit className="secondary">Update</Submit>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid-2" style={{ marginTop: "1rem" }}>
          <div>
            <h3>Add a checklist item</h3>
            <ActionForm action={addItemAction}>
              <input type="hidden" name="borrowerId" value={b.id} />
              <label>Item<input name="title" required /></label>
              <label>Description<input name="description" /></label>
              <div><Submit className="secondary">Add item</Submit></div>
            </ActionForm>
          </div>
          <div>
            <h3>Level 1 decision</h3>
            <ActionForm action={setL1Action}>
              <input type="hidden" name="borrowerId" value={b.id} />
              <label>
                Status
                <select name="status" defaultValue={l1?.status ?? "not_started"}>
                  <option value="not_started">Not started</option>
                  <option value="in_review">In review</option>
                  <option value="approved">Approved (baseline / refresh)</option>
                  <option value="rejected">Rejected</option>
                  <option value="refresh_required">Material change: refresh required</option>
                </select>
              </label>
              <label>Notes (internal)<textarea name="notes" defaultValue={l1?.notes ?? ""} /></label>
              <div><Submit>Save decision</Submit></div>
            </ActionForm>
            {l1?.approvedAt && <p className="small muted">Last approved {dateTime(l1.approvedAt)}</p>}
            {l1History.length > 0 && (
              <details className="history">
                <summary>Decision history ({l1History.length})</summary>
                <table>
                  <tbody>
                    {l1History.map((h) => (
                      <tr key={h.id}><td className="small">{dateTime(h.decidedAt)}</td><td><Badge status={h.status} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </div>
        </div>

        {docs.some((d) => !d.diligenceItemId) && (
          <>
            <h3 style={{ marginTop: "1rem" }}>Other files</h3>
            {docs.filter((d) => !d.diligenceItemId).map((d) => (
              <div key={d.id} className="small"><a href={`/api/credit/documents/${d.id}`}>{d.filename}</a> · {dateTime(d.createdAt)}</div>
            ))}
          </>
        )}
      </section>

      {/* ---------- Quarterly financials ---------- */}
      <section className="panel">
        <h2>Quarterly financials</h2>
        <p className="muted small">
          Heavier figures update each quarter, whatever the borrower&apos;s drawdown cycle. Lenders on this borrower&apos;s shared raises see them.
          {financialsBehind(financials[0]?.periodEnd) && <> <Badge status="refresh_due" label={`Not yet updated for the quarter ended ${lastQuarterEnd()}`} /></>}
        </p>
        {financials.length === 0 ? (
          <div className="empty">No quarterly figures yet.</div>
        ) : (
          <table>
            <thead><tr><th>Quarter ended</th><th className="num">AUM</th><th className="num">GNPA</th><th className="num">Leverage</th><th>Entered</th></tr></thead>
            <tbody>
              {financials.map((f) => (
                <tr key={f.id}>
                  <td>{f.periodEnd}</td>
                  <td className="num">{inr(f.aum)}</td>
                  <td className="num">{pct(f.gnpaPct)}</td>
                  <td className="num">{f.leverage ? `${f.leverage}x` : "—"}</td>
                  <td className="small">{dateTime(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ActionForm action={saveFinancialsAction} className="inline">
          <input type="hidden" name="borrowerId" value={b.id} />
          <label>Quarter ended<input name="periodEnd" type="date" required defaultValue={lastQuarterEnd()} /></label>
          <label>AUM (₹)<input name="aum" inputMode="decimal" /></label>
          <label>GNPA (%)<input name="gnpaPct" inputMode="decimal" /></label>
          <label>Leverage (x)<input name="leverage" inputMode="decimal" /></label>
          <Submit className="secondary">Save quarter</Submit>
        </ActionForm>
      </section>

      {/* ---------- Level 2 ---------- */}
      <section className="panel">
        <h2>Level 2 diligence (each lender&apos;s own)</h2>
        <p className="muted small">Lenders update this themselves from their dashboard. You can record a status they give you directly.</p>
        {l2.length === 0 ? (
          <div className="empty">No lender has started Level 2 on this borrower yet.</div>
        ) : (
          <table>
            <thead><tr><th>Lender</th><th>Status</th><th>Notes</th><th>Updated</th></tr></thead>
            <tbody>
              {l2.map(({ review, lenderName }) => (
                <tr key={review.id}>
                  <td><Link href={`/credit/admin/lenders/${review.lenderId}`}>{lenderName}</Link></td>
                  <td><Badge status={review.status} /></td>
                  <td className="small">{review.notes ?? "—"}</td>
                  <td className="small">{dateTime(review.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <details style={{ marginTop: "0.75rem" }}>
          <summary className="small">Record a lender&apos;s Level 2 status</summary>
          <ActionForm action={setL2AsAdminAction} className="inline">
            <input type="hidden" name="borrowerId" value={b.id} />
            <label>Lender<select name="lenderId" required>{lenders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
            <label>
              Status
              <select name="status">
                <option value="not_started">Not started</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            <label>Notes<input name="notes" /></label>
            <Submit className="secondary">Record</Submit>
          </ActionForm>
        </details>
      </section>

      {/* ---------- Raises ---------- */}
      <section className="panel">
        <h2>Raises <span className="small muted">{cycleName(b.drawdownCycle)} drawdown cycle</span></h2>
        {raises.length === 0 ? (
          <div className="empty">No raises yet for this borrower.</div>
        ) : (
          <table>
            <thead><tr><th>Period</th><th>Status</th><th className="num">Amount</th><th className="num">Filled</th><th>Lender rate</th></tr></thead>
            <tbody>
              {raises.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/credit/admin/raises/${r.id}`}>{cycleLabel(r.cycleStart, r.cycle)}</Link> <span className="small muted">{cycleName(r.cycle).toLowerCase()}</span></td>
                  <td><Badge status={r.status} /></td>
                  <td className="num">{inr(r.amount)}</td>
                  <td className="num">{inr(r.filledAmount)}</td>
                  <td>{pct(r.lenderRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid-2" style={{ marginTop: "1rem" }}>
          {latest && (
            <div>
              <h3>Next period&apos;s raise</h3>
              <p className="small muted">
                Starts a {b.drawdownCycle} draft for the period after {cycleLabel(latest.cycleStart, latest.cycle)} ({cycleLabel(nextStart, b.drawdownCycle)}) with
                the same amount, rates, security and terms. Edit before opening.
              </p>
              <ActionForm action={repeatRaiseAction}>
                <input type="hidden" name="id" value={latest.id} />
                <div><Submit>Repeat for next period</Submit></div>
              </ActionForm>
            </div>
          )}
          <div>
            <h3>New raise</h3>
            <ActionForm action={createRaiseAction}>
              <input type="hidden" name="borrowerId" value={b.id} />
              <RaiseFields securityLevels={ref.securityLevels} instruments={ref.instruments} segments={ref.segments} defaults={{ cycleStart: nextStart }} cycle={b.drawdownCycle} />
              <div><Submit className="secondary">Create draft raise</Submit></div>
            </ActionForm>
          </div>
        </div>
      </section>

      {/* ---------- Profile ---------- */}
      <section className="panel">
        <h2>Profile</h2>
        <ActionForm action={updateBorrowerAction}>
          <input type="hidden" name="id" value={b.id} />
          <BorrowerFields segments={ref.segments} b={b} segmentIds={segmentIds} />
          <div><Submit>Save profile</Submit></div>
        </ActionForm>
        <p className="small" style={{ marginTop: "0.75rem" }}>
          <Link href={`/credit/admin/activity?entity=borrower&id=${b.id}`}>Activity for this borrower</Link>
        </p>
      </section>
    </>
  );
}
