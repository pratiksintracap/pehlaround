import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/credit/server/session";
import { getRaise } from "@/lib/credit/server/admin/raises";
import { listReference } from "@/lib/credit/server/admin/reference";
import { listActivity } from "@/lib/credit/server/admin/overview";
import { listThreads } from "@/lib/credit/server/admin/messages";
import { NotFoundError } from "@/lib/credit/server/actors";
import { Badge, Check, Fill, cycleLabel, cycleName, dateTime, inr, pct } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import {
  postPlatformMessageAction,
  requestDocumentAction,
  repeatRaiseAction,
  revokeShareAction,
  setAllocationAction,
  setRaiseStatusAction,
  requestShareAction,
  requestSanctionAction,
  approveAction,
  rejectAction,
  cancelApprovalAction,
  recordMovementAction,
  updateRaiseAction,
} from "../../actions";
import { RaiseFields } from "../RaiseFields";

const NEXT_STATUSES: Record<string, { status: string; label: string; confirm?: string }[]> = {
  draft: [{ status: "open", label: "Open raise" }, { status: "cancelled", label: "Cancel", confirm: "Cancel this raise?" }],
  open: [
    { status: "funded", label: "Mark funded" },
    { status: "draft", label: "Back to draft" },
    { status: "cancelled", label: "Cancel", confirm: "Cancel this raise? Lenders will see it as cancelled." },
  ],
  funded: [{ status: "closed", label: "Close" }, { status: "open", label: "Reopen" }],
  closed: [],
  cancelled: [],
};

export default async function RaisePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const d = await getRaise(admin, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const [ref, log, threads] = await Promise.all([
    listReference(admin),
    listActivity(admin, { entityType: "raise", entityId: id, limit: 50 }),
    listThreads(admin, id),
  ]);
  const { raise: r } = d;
  const activeShares = d.shares.filter((s) => !s.share.revokedAt);
  const sharedIds = new Set(activeShares.map((s) => s.share.lenderId));
  const editable = !["closed", "cancelled"].includes(r.status);
  const pending = d.approvals.filter((x) => x.a.status === "pending");
  const pendingShareIds = new Set(
    pending.filter((x) => x.a.kind === "share").flatMap((x) => (x.a.payload as { lenderIds: string[] }).lenderIds),
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="small"><Link href={`/credit/admin/borrowers/${d.borrower.id}`}>{d.borrower.name}</Link></p>
          <h1>{cycleLabel(r.cycleStart, r.cycle)} raise</h1>
          <p className="muted">{cycleName(r.cycle)} cycle · <Badge status={r.status} /> Level 1 <Badge status={d.l1Status} /></p>
        </div>
        <div className="inline">
          {NEXT_STATUSES[r.status].map((s) => (
            <ActionForm key={s.status} action={setRaiseStatusAction} className="inline" confirm={s.confirm}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value={s.status} />
              <Submit className={s.status === "open" || s.status === "funded" ? undefined : "secondary"}>{s.label}</Submit>
            </ActionForm>
          ))}
          <ActionForm action={repeatRaiseAction} className="inline">
            <input type="hidden" name="id" value={r.id} />
            <Submit className="secondary">Repeat for next period</Submit>
          </ActionForm>
          <a className="button secondary" href={`/api/credit/raises/${r.id}/term-sheet`}>Term sheet (Word)</a>
        </div>
      </div>

      {r.status === "draft" && !d.l1Current && (
        <p className="note">This raise can&apos;t open until the borrower&apos;s Level 1 diligence is approved and within its quarterly refresh.</p>
      )}

      <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
        <div className="stat"><span className="muted small">Sell-down</span><Fill amount={r.amount} filled={r.filledAmount} /></div>
        <div className="stat">
          <span className="muted small">Borrower rate → lender rate</span>
          <strong>{pct(d.borrowerRate)} → {pct(r.lenderRate)}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Spread (platform only)</span>
          <strong>{pct(d.spread)}</strong>
          <span className="small muted">Borrower&apos;s expected band: {d.expectedRateMin || d.expectedRateMax ? `${pct(d.expectedRateMin)} – ${pct(d.expectedRateMax)}` : "not set"}</span>
        </div>
      </div>

      <section className="panel">
        <dl className="facts">
          <dt>Instrument</dt><dd>{d.instrument ?? <span className="muted">Not set (required to open)</span>}</dd>
          <dt>Segment funded</dt><dd>{d.segment ?? <span className="muted">Not set</span>}</dd>
          <dt>Purpose of funds</dt><dd style={{ whiteSpace: "pre-wrap" }}>{r.purpose ?? <span className="muted">Not set</span>}</dd>
        </dl>
      </section>

      {/* ---------- Maker-checker ---------- */}
      {pending.length > 0 && (
        <section className="panel" style={{ borderColor: "var(--warn)" }}>
          <h2>Waiting for a second admin</h2>
          <p className="muted small">Sharing and sanctioning are carried out only when an admin other than the requester approves.</p>
          <table>
            <tbody>
              {pending.map((x) => {
                const mine = x.a.requestedBy === admin.userId;
                const sanction = x.a.payload as { amount?: string };
                return (
                  <tr key={x.a.id}>
                    <td>
                      <strong>{x.a.kind === "share" ? "Share with " : "Sanction for "}{x.lenderNames.join(", ")}</strong>
                      {x.a.kind === "sanction" && <> · {inr(sanction.amount)}</>}
                      <div className="small muted">Requested by {mine ? "you" : x.requestedByName} · {dateTime(x.a.requestedAt)}</div>
                    </td>
                    <td>
                      {mine ? (
                        <ActionForm action={cancelApprovalAction} className="inline">
                          <input type="hidden" name="approvalId" value={x.a.id} />
                          <span className="small muted">Another admin must approve.</span>
                          <Submit className="secondary">Cancel request</Submit>
                        </ActionForm>
                      ) : (
                        <div className="inline">
                          <ActionForm action={approveAction} className="inline">
                            <input type="hidden" name="approvalId" value={x.a.id} />
                            <Submit>Approve</Submit>
                          </ActionForm>
                          <ActionForm action={rejectAction} className="inline">
                            <input type="hidden" name="approvalId" value={x.a.id} />
                            <input name="note" placeholder="Reason (optional)" aria-label="Reason for rejecting" />
                            <Submit className="danger">Reject</Submit>
                          </ActionForm>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ---------- Matching ---------- */}
      <section className="panel">
        <h2>Match lenders</h2>
        <p className="muted small">
          Ranked on each lender&apos;s thesis (segment, and headroom under their exposure target measured on amount outstanding), instrument,
          rate band, risk appetite and minimum ticket against what&apos;s unfilled. Sharing gives a lender this raise, its terms, the borrower
          profile, quarterly financials and Level 1 files. A second admin must approve before anything is shared.
        </p>
        {d.matches.length === 0 ? (
          <div className="empty">No lenders yet. <Link href="/credit/admin/lenders">Add a lender</Link>.</div>
        ) : (
          <ActionForm action={requestShareAction}>
            <input type="hidden" name="id" value={r.id} />
            <div className="table-wrap">
              <table>
                <thead><tr><th></th><th>Lender</th><th>Fit</th><th>Shared</th></tr></thead>
                <tbody>
                  {d.matches.map((m) => (
                    <tr key={m.lenderId}>
                      <td>
                        <input type="checkbox" name="lenderId" value={m.lenderId} disabled={sharedIds.has(m.lenderId) || pendingShareIds.has(m.lenderId) || r.status !== "open"} aria-label={`Share with ${m.lenderName}`} />
                      </td>
                      <td>
                        <Link href={`/credit/admin/lenders/${m.lenderId}`}>{m.lenderName}</Link>
                        {m.isMatch && <div><Badge status="pass" label="Match" /></div>}
                      </td>
                      <td>
                        <div className="inline">
                          <Check value={m.thesis} label={m.targetReached ? "Thesis (target reached)" : "Thesis"} />
                          <Check value={m.instrument} label="Instrument" />
                          <Check value={m.rateBand} label="Rate band" />
                          <Check value={m.riskAppetite} label="Risk appetite" />
                          <Check value={m.ticket} label="Ticket" />
                        </div>
                        {m.headroom != null && <div className="small muted">Headroom under target: {inr(m.headroom)}</div>}
                      </td>
                      <td>
                        {sharedIds.has(m.lenderId) ? <Badge status="open" label="Shared" /> : pendingShareIds.has(m.lenderId) ? <Badge status="new" label="Awaiting approval" /> : <span className="muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>{r.status === "open" ? <Submit>Request approval to share</Submit> : <span className="small muted">Open the raise to share it.</span>}</div>
          </ActionForm>
        )}
      </section>

      {/* ---------- Sell-down ---------- */}
      <section className="panel">
        <h2>Sell-down</h2>
        <p className="muted small">
          Each lender&apos;s part of this raise. Sanctioning commits capital, so it needs a second admin&apos;s approval. Record money as it moves:
          disbursed and outstanding come from those entries, and exposure is measured on outstanding. Each lender sees only its own line, plus the
          total and filled amounts without names.
        </p>
        {activeShares.length === 0 ? (
          <div className="empty">Share the raise with lenders to start the sell-down.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lender</th><th>Position</th><th>Sanction</th><th>Money moved</th><th></th></tr></thead>
              <tbody>
                {activeShares.map(({ share, lenderName }) => {
                  const row = d.allocations.find((x) => x.allocation.lenderId === share.lenderId);
                  const a = row?.allocation;
                  const committed = a && ["sanctioned", "disbursed"].includes(a.status);
                  const canChange = editable && ["open", "funded"].includes(r.status);
                  return (
                    <tr key={share.id}>
                      <td>
                        {lenderName}
                        <div className="small muted">Shared {dateTime(share.sharedAt)}</div>
                      </td>
                      <td>
                        {a ? <>{inr(a.amount)} <Badge status={a.status} /></> : <span className="muted">No indication yet</span>}
                        {a && a.termsVersion != null && a.termsVersion < r.termsVersion && (
                          <div><Badge status="refresh_due" label={`Given on terms v${a.termsVersion}; now v${r.termsVersion}`} /></div>
                        )}
                        {row?.balance && (
                          <div className="small muted">Disbursed {inr(row.balance.disbursed)} · Outstanding {inr(row.balance.outstanding)}</div>
                        )}
                        {committed && (
                          <div className="small"><a href={`/api/credit/raises/${r.id}/sanction-letter?lender=${share.lenderId}`}>Sanction letter draft (Word)</a></div>
                        )}
                      </td>
                      <td>
                        {canChange ? (
                          <>
                            <ActionForm action={requestSanctionAction} className="inline">
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="lenderId" value={share.lenderId} />
                              <label>Amount (₹)<input name="amount" inputMode="decimal" required defaultValue={a?.amount ?? ""} /></label>
                              <Submit className="secondary">{committed ? "Request change" : "Request sanction"}</Submit>
                            </ActionForm>
                            {!row?.balance && (
                              <details className="history small">
                                <summary>Record interest, decline or withdrawal</summary>
                                <ActionForm action={setAllocationAction} className="inline">
                                  <input type="hidden" name="id" value={r.id} />
                                  <input type="hidden" name="lenderId" value={share.lenderId} />
                                  <label>Amount (₹)<input name="amount" inputMode="decimal" required defaultValue={a?.amount ?? ""} /></label>
                                  <label>
                                    Status
                                    <select name="status" defaultValue={committed ? "withdrawn" : (a?.status ?? "interested")}>
                                      {!committed && <option value="interested">Interested</option>}
                                      <option value="declined">Declined</option>
                                      <option value="withdrawn">Withdrawn</option>
                                    </select>
                                  </label>
                                  <Submit className="secondary">Save</Submit>
                                </ActionForm>
                              </details>
                            )}
                          </>
                        ) : (
                          <span className="muted small">Locked</span>
                        )}
                      </td>
                      <td>
                        {committed ? (
                          <ActionForm action={recordMovementAction} className="stack">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="lenderId" value={share.lenderId} />
                            <div className="inline">
                              <label>
                                Type
                                <select name="kind" defaultValue={row?.balance && Number(row.balance.disbursed) >= Number(a!.amount) ? "repayment" : "disbursement"}>
                                  <option value="disbursement">Disbursement</option>
                                  <option value="repayment">Repayment</option>
                                </select>
                              </label>
                              <label>Amount (₹)<input name="amount" inputMode="decimal" required /></label>
                              <label>Value date<input name="valueDate" type="date" required max={today} defaultValue={today} /></label>
                            </div>
                            <div><Submit className="secondary">Record</Submit></div>
                          </ActionForm>
                        ) : (
                          <span className="muted small">After sanction</span>
                        )}
                      </td>
                      <td>
                        <ActionForm action={revokeShareAction} className="inline" confirm={`Revoke ${lenderName}'s access to this raise?`}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="lenderId" value={share.lenderId} />
                          <Submit className="danger">Revoke</Submit>
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {d.movements.length > 0 && (
          <details className="history" style={{ marginTop: "0.75rem" }}>
            <summary>Money movements ({d.movements.length})</summary>
            <table>
              <thead><tr><th>Value date</th><th>Lender</th><th>Type</th><th className="num">Amount</th><th>Entered by</th></tr></thead>
              <tbody>
                {d.movements.map(({ m, lenderName, enteredByName }) => (
                  <tr key={m.id}>
                    <td className="small">{m.valueDate}</td>
                    <td className="small">{lenderName}</td>
                    <td className="small">{m.kind === "disbursement" ? "Disbursement" : "Repayment"}</td>
                    <td className="num">{inr(m.amount)}</td>
                    <td className="small">{enteredByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      {/* ---------- Q&A ---------- */}
      <section className="panel">
        <h2>Lender questions</h2>
        <p className="muted small">One private thread per lender. A lender never sees another lender&apos;s thread. Lenders get an email saying there&apos;s a reply, with no deal details in it.</p>
        {threads.length === 0 ? (
          <div className="empty">Share the raise with a lender to open a thread with them.</div>
        ) : (
          threads.map((t) => (
            <details key={t.lenderId} open={t.awaitingReply} style={{ borderTop: "1px solid var(--rule)", padding: "0.6rem 0" }}>
              <summary>
                <strong>{t.lenderName}</strong>{" "}
                <span className="small muted">{t.messages.length} message{t.messages.length === 1 ? "" : "s"}</span>{" "}
                {t.awaitingReply && <Badge status="new" label="Awaiting reply" />}
                {t.revokedAt && <Badge status="inactive" label="Access revoked" />}
              </summary>
              <div className="thread" style={{ marginTop: "0.6rem" }}>
                {t.messages.length === 0 && <p className="small muted">No messages yet.</p>}
                {t.messages.map(({ m, authorName }) => (
                  <div key={m.id} className={`bubble ${m.authorSide === "platform" ? "mine" : ""}`}>
                    <span className="meta">{authorName ?? (m.authorSide === "platform" ? "Platform team" : t.lenderName)} · {dateTime(m.createdAt)}</span>
                    {m.body}
                  </div>
                ))}
              </div>
              {!t.revokedAt && (
                <div className="grid-2">
                  <ActionForm action={postPlatformMessageAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="lenderId" value={t.lenderId} />
                    <label>Reply to {t.lenderName}<textarea name="body" required /></label>
                    <div><Submit className="secondary">Send reply</Submit></div>
                  </ActionForm>
                  <ActionForm action={requestDocumentAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="lenderId" value={t.lenderId} />
                    <label>Document the lender asked for<input name="title" required /></label>
                    <label>Details (optional)<input name="description" /></label>
                    <div><Submit className="secondary">Add to Level 1 checklist</Submit></div>
                  </ActionForm>
                </div>
              )}
            </details>
          ))
        )}
      </section>

      {/* ---------- Terms ---------- */}
      <section className="panel">
        <h2>Terms <span className="small muted">version {r.termsVersion}</span></h2>
        {d.termsLocked && <p className="note">An allocation is sanctioned, so the terms are locked. Only the amount can still change.</p>}
        {editable ? (
          <ActionForm action={updateRaiseAction}>
            <input type="hidden" name="id" value={r.id} />
            <RaiseFields
              securityLevels={ref.securityLevels}
              instruments={ref.instruments}
              segments={ref.segments}
              defaults={{ ...r, borrowerRate: d.borrowerRate, expectedRateMin: d.expectedRateMin, expectedRateMax: d.expectedRateMax }}
              locked={d.termsLocked}
              cycleLocked={r.status !== "draft"}
              cycle={r.cycle}
            />
            {activeShares.length > 0 && <p className="note">This raise is shared with {activeShares.length} lender(s). Changes to rate, security or terms are visible to them immediately.</p>}
            <div><Submit>Save terms</Submit></div>
          </ActionForm>
        ) : (
          <dl className="facts">
            <dt>Amount</dt><dd>{inr(r.amount)}</dd>
            <dt>Lender rate</dt><dd>{pct(r.lenderRate)}</dd>
            <dt>Security</dt><dd>{r.securityDescription ?? "—"}</dd>
            <dt>Terms</dt><dd>{r.terms ?? "—"}</dd>
          </dl>
        )}
      </section>

      <section className="panel">
        <h2>Terms history</h2>
        <p className="muted small">Every version of the lender-facing terms. Lenders on this raise see the same history (without the borrower rate).</p>
        <table>
          <thead><tr><th>Version</th><th>When</th><th>By</th><th className="num">Amount</th><th>Lender rate</th><th>Instrument</th><th>Purpose</th><th>Security</th><th>Terms</th></tr></thead>
          <tbody>
            {d.termsHistory.map(({ h, changedByName, securityLevel, instrument }) => (
              <tr key={h.id}>
                <td>v{h.version}</td>
                <td className="small">{dateTime(h.changedAt)}</td>
                <td className="small">{changedByName ?? "—"}</td>
                <td className="num">{inr(h.amount)}</td>
                <td>{pct(h.lenderRate)}</td>
                <td className="small">{instrument ?? "—"}</td>
                <td className="small" style={{ whiteSpace: "pre-wrap" }}>{h.purpose ?? "—"}</td>
                <td className="small">{securityLevel ?? "—"}{h.securityDescription ? `: ${h.securityDescription}` : ""}</td>
                <td className="small" style={{ whiteSpace: "pre-wrap" }}>{h.terms ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Activity</h2>
        {log.length === 0 ? <div className="empty">No activity yet.</div> : (
          <table>
            <tbody>
              {log.map((l) => (
                <tr key={l.log.id}>
                  <td className="small">{dateTime(l.log.createdAt)}</td>
                  <td className="small">{l.actorName ?? l.log.actorRole}</td>
                  <td className="small">{l.log.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
