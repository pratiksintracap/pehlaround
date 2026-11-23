import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { LENDER_STATUSES, getDirectDeal } from "@/lib/credit/server/admin/direct-deals";
import { Badge, date } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { DealFiles } from "@/components/credit/app/DealFiles";
import { addDealLenderAction, updateDealLenderAction, updateDirectDealAction } from "../../actions";
import { DealFields } from "../DealFields";
import { LENDER_STATUS_LABEL, STAGE_LABEL, STAGE_TONE, cr } from "../labels";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const { deal: d, minCr, lenders, files, platformLenders } = await getDirectDeal(admin, id);
  const onDeal = new Set(lenders.map((l) => l.lenderId).filter(Boolean));
  const committed = lenders.filter((l) => l.status === "sanctioned" || l.status === "term_sheet").reduce((s, l) => s + Number(l.amountCr ?? 0), 0);
  return (
    <>
      <p className="small"><Link href="/credit/admin/deals">← Deals</Link></p>
      <div className="page-head">
        <div>
          <h1>{d.companyName}</h1>
          <p className="muted small">
            {[d.sector, d.city, d.state].filter(Boolean).join(" · ") || "Direct deal"} · added {date(d.createdAt)}
          </p>
        </div>
        <div className="inline">
          {Number(d.amountCr) < Number(minCr) && <Badge status="in_review" label={`Below ${cr(minCr)}`} />}
          <Badge status={STAGE_TONE[d.stage]} label={STAGE_LABEL[d.stage]} />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: "1.25rem" }}>
        <div className="stat"><span className="muted small">Amount needed</span><strong>{cr(d.amountCr)}</strong></div>
        <div className="stat"><span className="muted small">At term sheet or sanctioned</span><strong>{cr(committed)}</strong></div>
        <div className="stat"><span className="muted small">Lenders approached</span><strong>{lenders.filter((l) => l.status !== "to_approach").length} of {lenders.length}</strong></div>
      </div>

      <section className="panel">
        <h2>Lenders</h2>
        {lenders.length === 0 ? (
          <p className="muted small">No lenders on this deal yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lender</th><th colSpan={5}>Status · amount (₹ Cr) · rate · note</th></tr></thead>
              <tbody>
                {lenders.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.onPlatform ? <Link href={`/credit/admin/lenders/${l.lenderId}`}>{l.name}</Link> : l.name}
                      {!l.onPlatform && <div className="muted small">Not on the platform</div>}
                      <div className="muted small">Updated {date(l.updatedAt)}</div>
                    </td>
                    <td colSpan={5}>
                      <ActionForm action={updateDealLenderAction} className="inline">
                        <input type="hidden" name="rowId" value={l.id} />
                        <input type="hidden" name="dealId" value={d.id} />
                        <select name="status" defaultValue={l.status} aria-label="Status" style={{ width: "auto" }}>
                          {LENDER_STATUSES.map((s) => <option key={s} value={s}>{LENDER_STATUS_LABEL[s]}</option>)}
                        </select>
                        <input name="amountCr" inputMode="decimal" defaultValue={l.amountCr ? Number(l.amountCr).toString() : ""} aria-label="Amount (₹ Cr)" placeholder="₹ Cr" style={{ width: 90 }} />
                        <input name="rate" defaultValue={l.rate ?? ""} aria-label="Rate" placeholder="Rate" style={{ width: 110 }} />
                        <input name="note" defaultValue={l.note ?? ""} aria-label="Note" placeholder="Note" style={{ flex: 1, minWidth: 160 }} />
                        <button type="submit" className="secondary">Save</button>
                        <button type="submit" name="remove" value="1" className="link">Remove</button>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ActionForm action={addDealLenderAction} className="inline">
          <input type="hidden" name="dealId" value={d.id} />
          <label>
            A lender on the platform
            <select name="lenderId" defaultValue="">
              <option value="">—</option>
              {platformLenders.filter((l) => !onDeal.has(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label>or another lender (bank, NBFC, fund)<input name="lenderName" maxLength={200} placeholder="e.g. SIDBI" /></label>
          <Submit className="secondary">Add lender</Submit>
        </ActionForm>
      </section>

      <section className="panel">
        <h2>Files</h2>
        <DealFiles dealId={d.id} files={files} />
      </section>

      <section className="panel">
        <h2>Deal details</h2>
        <ActionForm action={updateDirectDealAction}>
          <input type="hidden" name="id" value={d.id} />
          <DealFields d={{ ...(d as unknown as Record<string, string | number | null>), amountCr: Number(d.amountCr).toString() }} />
          <div><Submit>Save</Submit></div>
        </ActionForm>
      </section>
    </>
  );
}
