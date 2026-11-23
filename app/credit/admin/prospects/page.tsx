import Link from "next/link";
import { requireAdmin } from "@/lib/credit/server/session";
import { listProspects, SORTS, type ProspectFilters, type SortKey } from "@/lib/credit/server/admin/prospects";
import { Badge, date } from "@/components/credit/app/ui";
import { ActionForm, Submit } from "@/components/credit/app/ActionForm";
import { saveBandAction } from "../actions";
import { PROSPECT_STATUS_LABEL, PROSPECT_STATUS_ORDER } from "./labels";
import { crore } from "./format";

type SP = Promise<Record<string, string | undefined>>;

export default async function ProspectsPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const view = sp.view === "all" ? "all" : "borrowers";
  const filters: ProspectFilters = { ...sp, view, page: Number(sp.page ?? 1) || 1 };
  const d = await listProspects(admin, filters);
  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/credit/admin/prospects?${p.toString()}`;
  };
  const sortLink = (key: SortKey) => {
    const active = d.sort === key;
    const nextDir = active && d.dir === "asc" ? "desc" : key === "aum" || key === "loanBook" || key === "lastContacted" || key === "priority" || key === "rating" ? (active ? "asc" : "desc") : "asc";
    return (
      <Link href={qs({ sort: key, dir: nextDir, page: undefined })} className="sort" aria-sort={active ? (d.dir === "asc" ? "ascending" : "descending") : undefined}>
        {SORTS[key].label}{active ? (d.dir === "asc" ? " ↑" : " ↓") : ""}
      </Link>
    );
  };
  const empty = d.total === 0 && !Object.values(sp).some(Boolean);
  const bandLabel = `₹${crore(d.band.minCr)}–${crore(d.band.maxCr)} Cr`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Prospects</h1>
          <p className="muted">
            NBFCs from RBI&apos;s register that aren&apos;t on the platform yet. Add each NBFC&apos;s loan book and AUM as you find them; the
            target band picks out the ones sized for the platform.
          </p>
        </div>
        <div className="inline">
          <Link className="button secondary" href="/credit/admin/prospects/template">Outreach template</Link>
          <Link className="button secondary" href="/credit/admin/prospects/research">Import research</Link>
          <Link className="button secondary" href="/credit/admin/prospects/import">Import RBI list</Link>
        </div>
      </div>

      {empty ? (
        <section className="panel">
          <div className="empty">No prospects yet. <Link href="/credit/admin/prospects/import">Import RBI&apos;s list of registered NBFCs</Link> to get started.</div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="inline" style={{ marginBottom: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <Link href={qs({ view: undefined, page: undefined })} className={`chip ${view === "borrowers" ? "on" : ""}`}>Likely borrowers</Link>
              <Link href={qs({ view: "all", page: undefined })} className={`chip ${view === "all" ? "on" : ""}`}>All NBFCs</Link>
              <span className="muted small" style={{ marginLeft: "0.5rem" }}>Size:</span>
              <Link href={qs({ size: sp.size === "band" ? undefined : "band", page: undefined })} className={`chip ${sp.size === "band" ? "on" : ""}`}>
                In band {bandLabel} <span className="muted">{d.facets.sizes.band}</span>
              </Link>
              <Link href={qs({ size: sp.size === "unknown" ? undefined : "unknown", page: undefined })} className={`chip ${sp.size === "unknown" ? "on" : ""}`}>
                Size unknown <span className="muted">{d.facets.sizes.unknown}</span>
              </Link>
              <Link href={qs({ size: sp.size === "outside" ? undefined : "outside", page: undefined })} className={`chip ${sp.size === "outside" ? "on" : ""}`}>
                Outside band <span className="muted">{d.facets.sizes.outside}</span>
              </Link>
              <span className="muted small" style={{ marginLeft: "0.5rem" }}>Rating:</span>
              <Link href={qs({ rated: sp.rated === "yes" ? undefined : "yes", page: undefined })} className={`chip ${sp.rated === "yes" ? "on" : ""}`}>
                Rated <span className="muted">{d.facets.sizes.rated}</span>
              </Link>
              <Link href={qs({ rated: sp.rated === "watch" ? undefined : "watch", page: undefined })} className={`chip ${sp.rated === "watch" ? "on" : ""}`} title="BBB or below, or a negative / issuer-not-cooperating outlook">
                BBB or below / negative
              </Link>
              <Link href={qs({ rated: sp.rated === "no" ? undefined : "no", page: undefined })} className={`chip ${sp.rated === "no" ? "on" : ""}`}>Unrated</Link>
            </div>
            <div className="inline" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
              {PROSPECT_STATUS_ORDER.map((s) => (
                <Link key={s} href={qs({ status: sp.status === s ? undefined : s, page: undefined })} className={`chip ${sp.status === s ? "on" : ""}`}>
                  {PROSPECT_STATUS_LABEL[s]} <span className="muted">{d.facets.statuses[s] ?? 0}</span>
                </Link>
              ))}
              <Link href={qs({ followUp: sp.followUp === "due" ? undefined : "due", page: undefined })} className={`chip ${sp.followUp === "due" ? "on" : ""}`}>Follow-up due</Link>
            </div>
            <form method="get" className="inline">
              {view === "all" && <input type="hidden" name="view" value="all" />}
              {sp.status && <input type="hidden" name="status" value={sp.status} />}
              {sp.size && <input type="hidden" name="size" value={sp.size} />}
              {sp.followUp && <input type="hidden" name="followUp" value={sp.followUp} />}
              {sp.rated && <input type="hidden" name="rated" value={sp.rated} />}
              {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
              {sp.dir && <input type="hidden" name="dir" value={sp.dir} />}
              <label>Search<input name="q" defaultValue={sp.q ?? ""} placeholder="Name, CIN or contact" /></label>
              <label>
                State
                <select name="state" defaultValue={sp.state ?? ""}>
                  <option value="">All</option>
                  {d.facets.states.map((f) => <option key={f.v} value={f.v}>{f.v} ({f.n})</option>)}
                </select>
              </label>
              <label>
                Type
                <select name="classification" defaultValue={sp.classification ?? ""}>
                  <option value="">All</option>
                  {d.facets.classifications.map((f) => <option key={f.v} value={f.v}>{f.v} ({f.n})</option>)}
                </select>
              </label>
              <label>
                Layer
                <select name="layer" defaultValue={sp.layer ?? ""}>
                  <option value="">All</option>
                  {d.facets.layers.map((f) => <option key={f.v} value={f.v}>{f.v} ({f.n})</option>)}
                </select>
              </label>
              <label>
                RBI office
                <select name="office" defaultValue={sp.office ?? ""}>
                  <option value="">All</option>
                  {d.facets.offices.map((f) => <option key={f.v} value={f.v}>{f.v} ({f.n})</option>)}
                </select>
              </label>
              <label className="check"><input type="checkbox" name="hasEmail" value="1" defaultChecked={sp.hasEmail === "1"} /> Has email</label>
              <label className="check"><input type="checkbox" name="hasContact" value="1" defaultChecked={sp.hasContact === "1"} /> Has contact person</label>
              <button type="submit">Filter</button>
              <Link href="/credit/admin/prospects" className="small">Clear</Link>
            </form>
            <p className="muted small" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
              Priority (0–100) ranks how likely an NBFC is to need the platform: size in the target band 40 (unknown 15) · rated BBB or below 20
              (unrated 10, A or above 5) · negative outlook or issuer not cooperating +10 · three or more known lenders 15 (one or two 10) · a named
              contact 10 (a registered email 5). Onboarded, not-a-fit and do-not-contact NBFCs score 0.
            </p>
            {view === "borrowers" && (
              <p className="muted small" style={{ marginTop: "0.6rem", marginBottom: 0 }}>
                Likely borrowers: Base-layer NBFCs, leaving out types that don&apos;t run their own loan book (account aggregators, P2P
                platforms, core investment and holding companies, primary dealers, mortgage guarantee companies and Type-I NBFCs).
                Choose &quot;All NBFCs&quot; to see everyone.
              </p>
            )}
          </section>

          <section className="panel">
            <h2>{d.total.toLocaleString("en-IN")} NBFC{d.total === 1 ? "" : "s"}</h2>
            {d.rows.length === 0 ? (
              <div className="empty">No NBFCs match these filters.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="num">{sortLink("priority")}</th>
                      <th>{sortLink("name")}</th>
                      <th className="num">{sortLink("aum")}</th>
                      <th className="num">{sortLink("loanBook")}</th>
                      <th>{sortLink("rating")}</th>
                      <th>{sortLink("state")}</th>
                      <th>Type</th>
                      <th>Contact</th>
                      <th>{sortLink("status")}</th>
                      <th>{sortLink("lastContacted")}</th>
                      <th>{sortLink("followUp")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.rows.map((p) => {
                      const size = p.aumCr ?? p.loanBookCr;
                      const inBand = size != null && Number(size) >= Number(d.band.minCr) && Number(size) <= Number(d.band.maxCr);
                      return (
                        <tr key={p.id} className={size != null && !inBand ? "dim" : undefined}>
                          <td className="num"><span className={`score ${p.priority >= 60 ? "hi" : p.priority >= 40 ? "mid" : ""}`}>{p.priority}</span></td>
                          <td>
                            <Link href={`/credit/admin/prospects/${p.id}`}>{p.name}</Link>
                            {inBand && <span className="badge ok" style={{ marginLeft: "0.4rem" }}>In band</span>}
                          </td>
                          <td className="num">{p.aumCr != null ? `₹${crore(p.aumCr)} Cr` : <span className="muted">—</span>}</td>
                          <td className="num">{p.loanBookCr != null ? `₹${crore(p.loanBookCr)} Cr` : <span className="muted">—</span>}</td>
                          <td className="small">
                            {p.rating ?? <span className="muted">—</span>}
                            {p.ratingOutlook && <div className={/negative|inc|not coop/i.test(p.ratingOutlook) ? "warn-text" : "muted"}>{p.ratingOutlook}</div>}
                            {p.lenderCount > 0 && <div className="muted">{p.lenderCount} lender{p.lenderCount === 1 ? "" : "s"}</div>}
                          </td>
                          <td className="small">{p.state ?? "—"}</td>
                          <td className="small">{p.classification ?? "—"}{p.layer && p.layer !== "Base Layer" ? ` · ${p.layer}` : ""}</td>
                          <td className="small">
                            {p.contactName ?? <span className="muted">—</span>}
                            {(p.contactEmail ?? p.registeredEmail) && <div className="muted">{p.contactEmail ?? p.registeredEmail}</div>}
                          </td>
                          <td><Badge status={p.status} label={PROSPECT_STATUS_LABEL[p.status]} /></td>
                          <td className="small">{p.lastContactedAt ? date(p.lastContactedAt) : "—"}</td>
                          <td className="small">{p.nextFollowUp ? date(p.nextFollowUp) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {d.pages > 1 && (
              <div className="inline" style={{ marginTop: "0.75rem", alignItems: "center" }}>
                {d.page > 1 && <Link href={qs({ page: d.page - 1 })}>Previous</Link>}
                <span className="muted small">Page {d.page} of {d.pages}</span>
                {d.page < d.pages && <Link href={qs({ page: d.page + 1 })}>Next</Link>}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Target band</h2>
            <p className="muted small">
              The book size the platform is for. A prospect is in the band when its AUM (or its loan book, if AUM isn&apos;t known) falls inside it.
            </p>
            <ActionForm action={saveBandAction} className="inline">
              <label>From (₹ Cr)<input name="minCr" inputMode="decimal" defaultValue={crore(d.band.minCr)} required /></label>
              <label>To (₹ Cr)<input name="maxCr" inputMode="decimal" defaultValue={crore(d.band.maxCr)} required /></label>
              <Submit className="secondary">Save band</Submit>
            </ActionForm>
          </section>
        </>
      )}
    </>
  );
}
