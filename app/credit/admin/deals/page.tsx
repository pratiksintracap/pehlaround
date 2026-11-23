import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { DEAL_STAGES, listDirectDeals } from "@/lib/credit/server/admin/direct-deals";
import { Badge, date } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { createDirectDealAction, saveDirectMinAction } from "../actions";
import { DealFields } from "./DealFields";
import { STAGE_LABEL, STAGE_TONE, cr } from "./labels";

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const d = await listDirectDeals(admin, { view: sp.view, stage: sp.stage });
  const openCr = (["lead", "diligence", "with_lenders", "term_sheet", "sanctioned"] as const).reduce((s, k) => s + Number(d.counts[k]?.cr ?? 0), 0);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Deals</h1>
          <p className="muted">
            Large lending requirements from companies that aren&apos;t NBFCs, arranged directly with lenders. For the team only: lenders and
            partners don&apos;t see this page. Deals below {cr(d.minCr)} are flagged.
          </p>
        </div>
        <a className="button" href="#add">Add a deal</a>
      </div>

      <section className="panel">
        <div className="inline" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/credit/admin/deals" className={`chip ${!sp.stage && sp.view !== "all" ? "on" : ""}`}>Open <span className="muted">{cr(openCr)}</span></Link>
          {DEAL_STAGES.map((s) => (
            <Link key={s} href={`/credit/admin/deals?stage=${s}`} className={`chip ${sp.stage === s ? "on" : ""}`}>
              {STAGE_LABEL[s]} <span className="muted">{d.counts[s]?.n ?? 0}</span>
            </Link>
          ))}
          <Link href="/credit/admin/deals?view=all" className={`chip ${sp.view === "all" && !sp.stage ? "on" : ""}`}>All</Link>
        </div>
      </section>

      <section className="panel">
        {d.rows.length === 0 ? (
          <div className="empty">No deals here yet. <a href="#add">Add the first one</a>.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="num">Amount</th>
                  <th>Facility</th>
                  <th>Stage</th>
                  <th>Lenders</th>
                  <th>Next step</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/credit/admin/deals/${r.id}`}>{r.companyName}</Link>
                      {r.belowMin && <span className="badge warn" style={{ marginLeft: "0.4rem" }}>Below {cr(d.minCr)}</span>}
                      {r.sector && <div className="muted small">{r.sector}</div>}
                    </td>
                    <td className="num">{cr(r.amountCr)}</td>
                    <td className="small">{r.facility ?? "—"}{r.tenorMonths ? ` · ${r.tenorMonths} months` : ""}</td>
                    <td><Badge status={STAGE_TONE[r.stage]} label={STAGE_LABEL[r.stage]} /></td>
                    <td className="small">
                      {r.lenderCount ? `${r.lenderCount} lender${r.lenderCount === 1 ? "" : "s"} · ${r.approached} approached · ${r.interested} interested` : "—"}
                      {r.committedCr > 0 && <div className="muted">{cr(r.committedCr)} at term sheet or sanctioned</div>}
                    </td>
                    <td className="small">{r.nextStep ?? "—"}{r.nextStepOn && <div className="muted">by {date(r.nextStepOn)}</div>}</td>
                    <td className="small">{date(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" id="add">
        <h2>Add a deal</h2>
        <ActionForm action={createDirectDealAction}>
          <DealFields />
          <div><Submit>Add deal</Submit></div>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Minimum deal size</h2>
        <ActionForm action={saveDirectMinAction} className="inline">
          <label>Smallest direct deal (₹ Cr)<input name="minCr" inputMode="decimal" defaultValue={Number(d.minCr).toString()} required /></label>
          <Submit className="secondary">Save</Submit>
        </ActionForm>
        <p className="muted small" style={{ margin: "0.5rem 0 0" }}>Smaller deals can still be added; they&apos;re marked so they stand out.</p>
      </section>
    </>
  );
}
