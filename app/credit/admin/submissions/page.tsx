import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listSubmissions, listWebsiteStarts } from "@/lib/credit/server/intake/admin";
import { Badge, date } from "@/components/credit/app/ui";
import { INTAKE_STATUS_LABEL } from "@/app/credit/partner/labels";

const ORDER = ["submitted", "in_review", "needs_info", "accepted", "declined", "draft"] as const;

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const [d, starts] = await Promise.all([listSubmissions(admin, { status: sp.status, partner: sp.partner }), listWebsiteStarts(admin)]);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/credit/admin/submissions?${p.toString()}`;
  };
  const cr = (n: number | null | string) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Submissions</h1>
          <p className="muted">
            Borrower NBFCs sent in through the information form, by partners or from the website. Review each one, ask for anything
            missing, and accept it to create the borrower with its files attached.
          </p>
        </div>
        <div className="inline">
          <Link className="button" href="/credit/admin/submissions/new">Add a company for a partner</Link>
          <Link className="button secondary" href="/credit/admin/partners">Partners</Link>
        </div>
      </div>

      <section className="panel">
        <div className="inline" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <Link href={qs({ status: undefined })} className={`chip ${!sp.status ? "on" : ""}`}>All sent</Link>
          {ORDER.map((s) => (
            <Link key={s} href={qs({ status: s })} className={`chip ${sp.status === s ? "on" : ""}`}>
              {s === "draft" ? "Drafts" : INTAKE_STATUS_LABEL[s]} <span className="muted">{d.counts[s] ?? 0}</span>
            </Link>
          ))}
          {d.partners.length > 1 && (
            <form method="get" className="inline" style={{ marginLeft: "auto" }}>
              {sp.status && <input type="hidden" name="status" value={sp.status} />}
              <select name="partner" defaultValue={sp.partner ?? ""} aria-label="Partner">
                <option value="">All partners</option>
                {d.partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="submit" className="secondary">Show</button>
            </form>
          )}
        </div>
      </section>

      {starts.length > 0 && (
        <section className="panel" aria-labelledby="starts-h">
          <h2 id="starts-h">Started on the website, not sent yet <span className="muted">{starts.length}</span></h2>
          <p className="muted small">
            Everyone who filled in the first step on the website. They have an account under their email and can come back to finish; a call
            often helps.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Started by</th>
                  <th>Contact</th>
                  <th>Progress</th>
                  <th>Started</th>
                  <th>Last saved</th>
                </tr>
              </thead>
              <tbody>
                {starts.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/credit/admin/submissions/${r.id}`}>{r.companyName}</Link>
                      {r.cin && <div className="muted small">{r.cin}</div>}
                    </td>
                    <td className="small">
                      {r.submitterName ?? "—"}
                      <div className="muted">{r.submitterRole === "agent" ? `Agent${r.agentFirm ? `, ${r.agentFirm}` : ""}` : "The NBFC"}</div>
                    </td>
                    <td className="small">
                      {r.email && <a href={`mailto:${r.email}`}>{r.email}</a>}
                      {r.phone && <div><a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`}>{r.phone}</a></div>}
                    </td>
                    <td className="small">
                      {r.pct}% of answers{r.fileCount ? `, ${r.fileCount} files` : ""}
                      {r.readyToSend && <div><span className="badge ok">Ready to send</span></div>}
                    </td>
                    <td className="small">{date(r.createdAt)}</td>
                    <td className="small">{date(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        {d.rows.length === 0 ? (
          <div className="empty">
            Nothing here yet. {d.partners.length === 0 ? <><Link href="/credit/admin/partners">Add a partner</Link> and the people who&apos;ll fill the form.</> : "Partners' companies appear here once they send them."}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Partner</th>
                  <th className="num">AUM</th>
                  <th className="num">Needs (12 months)</th>
                  <th>Status</th>
                  <th>Gaps</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/credit/admin/submissions/${r.id}`}>{r.companyName}</Link>
                      {r.inBand === true && <span className="badge ok" style={{ marginLeft: "0.4rem" }}>In band</span>}
                      {r.inBand === false && <span className="badge warn" style={{ marginLeft: "0.4rem" }}>Outside band</span>}
                    </td>
                    <td className="small">{r.partnerName}</td>
                    <td className="num">{cr(r.aum)}</td>
                    <td className="num">{cr(r.amount12m)}</td>
                    <td><Badge status={r.status} label={INTAKE_STATUS_LABEL[r.status]} /></td>
                    <td className="small">{r.missingCount ? `${r.missingCount} items to add` : "Complete"} · {r.fileCount} files</td>
                    <td className="small">{r.submittedAt ? date(r.submittedAt) : "—"}</td>
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
