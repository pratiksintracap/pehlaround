import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLender } from "@/lib/credit/server/session";
import { getDeal } from "@/lib/credit/server/lender/deals";
import { NotFoundError } from "@/lib/credit/server/actors";
import { Badge, Fill, cycleLabel, cycleName, date, dateTime, inr, pct } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { expressInterestAction, postMessageAction, setLevel2Action, withdrawInterestAction } from "../../actions";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const lender = await requireLender();
  const { id } = await params;
  const d = await getDeal(lender, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const canAct = lender.role === "lender_admin";
  const { raise: r } = d;
  const canIndicate = canAct && r.status === "open" && (!d.myAllocation || ["interested", "withdrawn"].includes(d.myAllocation.status));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href="/credit/lender">Deal flow</Link></p>
          <h1>{d.borrower.name}</h1>
          <p className="muted">{cycleLabel(r.cycleStart, r.cycle)} raise ({cycleName(r.cycle).toLowerCase()} cycle) <Badge status={r.status} /></p>
        </div>
        <div className="inline">
          <a className="button secondary" href={`/api/credit/raises/${r.raiseId}/term-sheet`}>Term sheet (Word)</a>
          {d.sanctionLetterAvailable && <a className="button secondary" href={`/api/credit/raises/${r.raiseId}/sanction-letter`}>Sanction letter draft (Word)</a>}
        </div>
      </div>

      {d.myAllocation?.onOlderTerms && (
        <p className="note">
          The terms changed after your team indicated interest (you indicated on version {d.myAllocation.termsVersion}; current is version{" "}
          {r.termsVersion}). Review the terms history below{canIndicate ? " and update your interest to confirm" : ""}.
        </p>
      )}

      <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
        <div className="stat"><span className="muted small">Your rate (same for every lender in this raise)</span><strong>{pct(r.lenderRate)}</strong></div>
        <div className="stat"><span className="muted small">Raise filled</span><Fill amount={r.amount} filled={r.filledAmount} /></div>
        <div className="stat">
          <span className="muted small">Your position</span>
          <strong>{d.myAllocation ? inr(d.myAllocation.amount) : "—"}</strong>
          {d.myAllocation && <Badge status={d.myAllocation.status} />}
          {d.myBalance && <span className="small muted">Disbursed {inr(d.myBalance.disbursed)} · Outstanding {inr(d.myBalance.outstanding)}</span>}
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Terms <span className="small muted">version {r.termsVersion}</span></h2>
          <dl className="facts">
            <dt>Raise size</dt><dd>{inr(r.amount)}</dd>
            <dt>Instrument</dt><dd>{r.instrument ?? "—"}</dd>
            <dt>Rate</dt><dd>{pct(r.lenderRate)} p.a.</dd>
            <dt>Purpose of funds</dt><dd style={{ whiteSpace: "pre-wrap" }}>{r.purpose ?? "—"}</dd>
            <dt>Segment funded</dt><dd>{r.segmentFunded ?? "—"}</dd>
            <dt>Security level</dt><dd>{r.securityLevel ?? "—"}</dd>
            <dt>Security</dt><dd style={{ whiteSpace: "pre-wrap" }}>{r.securityDescription ?? "—"}</dd>
            <dt>Terms</dt><dd style={{ whiteSpace: "pre-wrap" }}>{r.terms ?? "—"}</dd>
          </dl>
          <p className="small muted" style={{ marginTop: "0.75rem" }}>Security and terms are the same for every lender in this raise.</p>
          {d.termsHistory.length > 1 && (
            <details className="history">
              <summary>Terms history ({d.termsHistory.length} versions)</summary>
              <table>
                <thead><tr><th>Version</th><th>Changed</th><th className="num">Amount</th><th>Rate</th><th>Instrument</th><th>Security</th><th>Terms</th></tr></thead>
                <tbody>
                  {d.termsHistory.map((h) => (
                    <tr key={h.version}>
                      <td>v{h.version}</td>
                      <td className="small">{dateTime(h.changedAt)}</td>
                      <td className="num">{inr(h.amount)}</td>
                      <td>{pct(h.lenderRate)}</td>
                      <td className="small">{h.instrument ?? "—"}</td>
                      <td className="small">{h.securityLevel ?? "—"}{h.securityDescription ? `: ${h.securityDescription}` : ""}</td>
                      <td className="small" style={{ whiteSpace: "pre-wrap" }}>{h.terms ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </section>

        <section className="panel">
          <h2>Borrower</h2>
          <dl className="facts">
            <dt>Name</dt><dd>{d.borrower.name}</dd>
            <dt>CIN</dt><dd>{d.borrower.cin ?? "—"}</dd>
            <dt>RBI registration</dt><dd>{d.borrower.rbiRegistration ?? "—"}</dd>
            <dt>Location</dt><dd>{[d.borrower.city, d.borrower.state].filter(Boolean).join(", ") || "—"}</dd>
            <dt>Segments</dt><dd>{d.borrower.segments.join(", ") || "—"}</dd>
          </dl>
        </section>
      </div>

      <section className="panel">
        <h2>Quarterly financials</h2>
        {d.financialsBehind && d.financials.length > 0 && <p className="note">Figures for the most recent quarter haven&apos;t been added yet.</p>}
        {d.financials.length === 0 ? (
          <div className="empty">No quarterly figures yet.</div>
        ) : (
          <table>
            <thead><tr><th>Quarter ended</th><th className="num">AUM</th><th className="num">GNPA</th><th className="num">Leverage</th></tr></thead>
            <tbody>
              {d.financials.map((f) => (
                <tr key={f.periodEnd}>
                  <td>{f.periodEnd}</td>
                  <td className="num">{inr(f.aum)}</td>
                  <td className="num">{pct(f.gnpaPct)}</td>
                  <td className="num">{f.leverage ? `${f.leverage}x` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>Level 1 diligence (platform screening)</h2>
        <p className="muted small">
          Status <Badge status={d.level1.status} />
          {d.level1.approvedAt && <> · approved {date(d.level1.approvedAt)}</>}
          {d.level1.refreshDueAt && <> · next refresh {date(d.level1.refreshDueAt)}</>}
        </p>
        {d.level1History.length > 0 && (
          <details className="history" style={{ marginBottom: "0.75rem" }}>
            <summary>Level 1 decision history</summary>
            <table>
              <tbody>
                {d.level1History.map((h, i) => (
                  <tr key={i}><td className="small">{dateTime(h.decidedAt)}</td><td><Badge status={h.status} /></td></tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
        {d.items.length === 0 ? <div className="empty">No diligence items have been added yet.</div> : (
          <table>
            <thead><tr><th>Item</th><th>Status</th><th>Files</th></tr></thead>
            <tbody>
              {d.items.map((it) => (
                <tr key={it.id}>
                  <td><strong>{it.title}</strong>{it.description && <div className="small muted">{it.description}</div>}</td>
                  <td><Badge status={it.status} /></td>
                  <td>
                    {d.documents.filter((x) => x.itemId === it.id && !x.supersededAt).map((x) => (
                      <div key={x.id} className="small"><a href={`/api/credit/documents/${x.id}`}>{x.filename}</a></div>
                    ))}
                    {d.documents.some((x) => x.itemId === it.id && x.supersededAt) && (
                      <details className="history small">
                        <summary>Earlier versions</summary>
                        {d.documents.filter((x) => x.itemId === it.id && x.supersededAt).map((x) => (
                          <div key={x.id}><a className="earlier" href={`/api/credit/documents/${x.id}`}>{x.filename}</a> <span className="muted">replaced {date(x.supersededAt)}</span></div>
                        ))}
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {d.documents.some((x) => !x.itemId) && (
          <>
            <h3 style={{ marginTop: "1rem" }}>Other files</h3>
            {d.documents.filter((x) => !x.itemId).map((x) => (
              <div key={x.id} className="small"><a href={`/api/credit/documents/${x.id}`}>{x.filename}</a> · {dateTime(x.createdAt)}</div>
            ))}
          </>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Your Level 2 diligence</h2>
          <p className="muted small">Your own diligence on this borrower. Only your team and the platform team see this.</p>
          {canAct ? (
            <ActionForm action={setLevel2Action}>
              <input type="hidden" name="raiseId" value={r.raiseId} />
              <label>
                Status
                <select name="status" defaultValue={d.myLevel2.status}>
                  <option value="not_started">Not started</option>
                  <option value="in_review">In review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label>Notes<textarea name="notes" defaultValue={d.myLevel2.notes ?? ""} /></label>
              <div><Submit>Save Level 2</Submit></div>
            </ActionForm>
          ) : (
            <p><Badge status={d.myLevel2.status} /> {d.myLevel2.notes && <span className="small">{d.myLevel2.notes}</span>}</p>
          )}
          {d.myLevel2.updatedAt && <p className="small muted">Updated {dateTime(d.myLevel2.updatedAt)}</p>}
        </section>

        <section className="panel">
          <h2>Your participation</h2>
          {canIndicate ? (
            <>
              <p className="muted small">Indicate the amount you&apos;d like to take. The platform team confirms the sanctioned amount with you.</p>
              <ActionForm action={expressInterestAction} className="inline">
                <input type="hidden" name="raiseId" value={r.raiseId} />
                <label>Amount (₹)<input name="amount" inputMode="decimal" required defaultValue={d.myAllocation?.status === "interested" ? d.myAllocation.amount : ""} /></label>
                <Submit>{d.myAllocation?.status === "interested" ? "Update interest" : "Indicate interest"}</Submit>
              </ActionForm>
              {d.myAllocation?.status === "interested" && (
                <ActionForm action={withdrawInterestAction} className="inline" confirm="Withdraw your interest in this raise?">
                  <input type="hidden" name="raiseId" value={r.raiseId} />
                  <Submit className="secondary">Withdraw interest</Submit>
                </ActionForm>
              )}
            </>
          ) : d.myAllocation ? (
            <>
              <p>{inr(d.myAllocation.amount)} <Badge status={d.myAllocation.status} /> <span className="small muted">Contact the platform team to change a confirmed allocation.</span></p>
              {d.myMovements.length > 0 && (
                <table>
                  <thead><tr><th>Value date</th><th>Type</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {d.myMovements.map((m, i) => (
                      <tr key={i}><td className="small">{m.valueDate}</td><td className="small">{m.kind === "disbursement" ? "Disbursement" : "Repayment"}</td><td className="num">{inr(m.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <p className="muted small">{canAct ? "This raise isn't open for new interest." : "Your account is view-only. A lender admin on your team can indicate interest."}</p>
          )}
        </section>
      </div>
      <section className="panel">
        <h2>Questions for the platform team</h2>
        <p className="muted small">Private to your team and the platform team. Ask for anything you need for your Level 2 diligence; requested documents are collected from the borrower and added to the diligence section.</p>
        <div className="thread">
          {d.thread.length === 0 && <p className="small muted">No messages yet.</p>}
          {d.thread.map((m) => (
            <div key={m.id} className={`bubble ${m.authorSide === "lender" ? "mine" : ""}`}>
              <span className="meta">{m.authorName ?? "Your team"} · {dateTime(m.createdAt)}</span>
              {m.body}
            </div>
          ))}
        </div>
        {canAct ? (
          <ActionForm action={postMessageAction}>
            <input type="hidden" name="raiseId" value={r.raiseId} />
            <label>Your question<textarea name="body" required /></label>
            <div><Submit>Send</Submit></div>
          </ActionForm>
        ) : (
          <p className="small muted">Your account is view-only. A lender admin on your team can post questions.</p>
        )}
      </section>
    </>
  );
}
