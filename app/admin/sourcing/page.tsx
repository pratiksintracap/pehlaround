// Sourcing: companies the assistant finds every morning that may suit the desk, and where the outreach to each stands.
// The flow: found > draft ready (in the desk mailbox) > emailed > interested (call task for the banker) > on the pipeline.
// Desk only; nothing here reaches any investor page.
import { desc, eq } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { can } from "@/lib/perm";
import { getDb } from "@/lib/db";
import { emailLog, prospects } from "@/db/schema";
import { deskMembers } from "@/lib/desk";
import { PROSPECT_STATUS, prospectLabel } from "@/lib/prospects";
import { addProspectByHand, approveAllProspectEmails, approveProspectEmail, prospectToDeal, saveProspectEmail, setProspect } from "@/lib/sourcing-actions";
import { emailReady } from "@/lib/email";
import { fmtT } from "@/components/DeskBits";

export const dynamic = "force-dynamic";

const OPEN = ["new", "drafted", "approved", "emailed", "interested"];
const KIND: Record<string, string> = { equity: "Pre-IPO equity", debt: "Debt", both: "Equity or debt" };
const cr = (v: number | null) => (v == null ? "—" : `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr`);

// How engaged a company is, from what the desk can see: a reply, then link clicks and opens of the desk's emails
// (from the email provider's delivery status), then how recently it was written to. Higher is more active.
type Act = { score: number; label: string; tone: "ok" | "mid" | "off" | "" };
function activity(p: typeof prospects.$inferSelect, ev: { opened: number; clicked: number; bounced: number } | undefined, now: number): Act {
  const days = (d: Date | null) => (d ? Math.floor((now - +d) / 864e5) : null);
  if (p.status === "interested" || p.status === "added") return { score: 100, label: p.repliedAt ? `Replied with interest ${fmtT(p.repliedAt)}` : "Interested", tone: "ok" };
  if (p.status === "declined") return { score: 30, label: p.repliedAt ? `Replied: not now (${fmtT(p.repliedAt)})` : "Replied: not now", tone: "off" };
  if (p.repliedAt) return { score: 90, label: `Replied ${fmtT(p.repliedAt)}`, tone: "ok" };
  if (ev?.bounced && !ev.opened && !ev.clicked) return { score: 5, label: "Email bounced: check the address", tone: "off" };
  if (ev?.clicked) return { score: 70 + Math.min(ev.clicked, 5), label: `Clicked the link${ev.clicked > 1 ? ` (${ev.clicked} emails)` : ""}, no reply yet`, tone: "mid" };
  if (ev?.opened) return { score: 50 + Math.min(ev.opened, 5), label: `Opened${ev.opened > 1 ? ` (${ev.opened} emails)` : ""}, no reply yet`, tone: "mid" };
  if (p.emailedAt) { const d = days(p.emailedAt) ?? 0; return { score: 20 - Math.min(d, 15), label: `Emailed ${d === 0 ? "today" : `${d} day${d === 1 ? "" : "s"} ago`}${p.sends > 1 ? ` (${p.sends} emails)` : ""}, no response`, tone: "" }; }
  if (p.status === "approved") return { score: 10, label: "Approved, goes at 9 AM", tone: "" };
  if (p.status === "drafted") return { score: 8, label: "Draft waiting for approval", tone: "" };
  return { score: 0, label: "Not contacted", tone: "" };
}
const SORTS = [["active", "Most active"], ["revenue", "Revenue"], ["pat", "Profit"], ["growth", "Growth"], ["new", "Newest found"], ["emailed", "Recently emailed"], ["az", "A–Z"]] as const;
const REACH = [["", "Any outreach"], ["yes", "Reached out"], ["no", "Not reached out"]] as const;
const RESP = [["", "Any response"], ["replied", "Replied"], ["engaged", "Opened or clicked, no reply"], ["none", "Emailed, no response"], ["bounced", "Bounced"]] as const;
const BANDS = [["", "Any revenue"], ["50-100", "₹50–100 Cr"], ["100-250", "₹100–250 Cr"], ["250-500", "₹250–500 Cr"], ["500-", "₹500 Cr +"]] as const;

export default async function Sourcing({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string; sort?: string; reach?: string; resp?: string; rev?: string; s?: string }> }) {
  const me = await requireDesk();
  const { status = "open", kind = "", sort = "active", reach = "", resp = "", rev = "", s: find = "" } = await searchParams;
  const db = await getDb();
  const [all, members, mails] = await Promise.all([db.select().from(prospects).orderBy(desc(prospects.createdAt)), deskMembers(),
    db.select({ to: emailLog.to, ev: emailLog.lastEvent }).from(emailLog).where(eq(emailLog.kind, "sourcing"))]);
  const who = new Map(members.map((m) => [m.id, m.name]));
  // Delivery status per address: how many of the desk's emails to it were opened, clicked or bounced.
  const evBy = new Map<string, { opened: number; clicked: number; bounced: number }>();
  for (const m of mails) { const k = m.to.toLowerCase(), e = (m.ev ?? "").toLowerCase(), x = evBy.get(k) ?? { opened: 0, clicked: 0, bounced: 0 };
    if (e.includes("click")) { x.clicked++; x.opened++; } else if (e.includes("open")) x.opened++; else if (e.includes("bounce")) x.bounced++; evBy.set(k, x); }
  const now = Date.now();
  const act = new Map(all.map((p) => [p.id, activity(p, p.contactEmail ? evBy.get(p.contactEmail.toLowerCase()) : undefined, now)]));
  const terms = find.toLowerCase().split(/\s+/).filter(Boolean);
  const [lo, hi] = rev ? rev.split("-").map((x) => (x ? Number(x) : null)) : [null, null];
  const list = all.filter((p) => (status === "all" ? true : status === "open" ? OPEN.includes(p.status) : p.status === status) && (!kind || p.kind === kind || (kind !== "both" && p.kind === "both"))
    && (!reach || (reach === "yes" ? p.sends > 0 || !!p.emailedAt : !(p.sends > 0 || p.emailedAt)))
    && (!resp || (() => { const a = act.get(p.id)!; return resp === "replied" ? !!p.repliedAt || ["interested", "declined", "added"].includes(p.status)
      : resp === "engaged" ? a.tone === "mid" : resp === "bounced" ? a.label.startsWith("Email bounced") : !!p.emailedAt && !p.repliedAt && a.tone === ""; })())
    && (!rev || (p.revenueCr != null && (lo == null || p.revenueCr >= lo) && (hi == null || p.revenueCr < hi)))
    && terms.every((t) => [p.company, p.sector, p.city, p.why, p.contactName, p.rating, ...(p.signals ?? [])].join(" ").toLowerCase().includes(t)));
  const num = (v: number | null) => (v == null ? -Infinity : v);
  list.sort((a, b) => sort === "revenue" ? num(b.revenueCr) - num(a.revenueCr) : sort === "pat" ? num(b.patCr) - num(a.patCr) : sort === "growth" ? num(b.growthPct) - num(a.growthPct)
    : sort === "new" ? +b.createdAt - +a.createdAt : sort === "emailed" ? +(b.emailedAt ?? 0) - +(a.emailedAt ?? 0) : sort === "az" ? a.company.localeCompare(b.company)
    : act.get(b.id)!.score - act.get(a.id)!.score || num(b.revenueCr) - num(a.revenueCr));
  const count = (st: string) => all.filter((p) => p.status === st).length;
  const edit = can(me, "deals.edit");
  const q = (o: Record<string, string>) => { const u = new URLSearchParams({ ...(status !== "open" ? { status } : {}), ...(kind ? { kind } : {}), ...(sort !== "active" ? { sort } : {}), ...(reach ? { reach } : {}), ...(resp ? { resp } : {}), ...(rev ? { rev } : {}), ...(find ? { s: find } : {}), ...o }); for (const [k, v] of [...u]) if (!v || (k === "status" && v === "open") || (k === "sort" && v === "active")) u.delete(k); const t = u.toString(); return `/admin/sourcing${t ? `?${t}` : ""}`; };
  const back = q({});
  return (
    <>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "6px 0 6px" }}>
        <h1 style={{ fontSize: 30, margin: 0 }}>Sourcing</h1><span className="pill">Desk only</span>
        {edit && <a className="btn sm" href="#add">+ Add a company</a>}<a className="btn sm" href="/admin/sourcing/pool">Sourcing pool</a></div>
      <p className="fine" style={{ marginBottom: 12 }}>Companies the assistant finds each weekday morning: unlisted, ₹50–1,000 Cr revenue, profitable and growing, from rating rationales, news and filings. For each one it reads the company&apos;s website and writes an outreach email, shown on the row for review. <b>Nothing is sent until someone here approves it</b>; it then goes from the desk address. When a company replies with interest, Puneet gets a call task. Make a prospect a deal with <i>Pre-IPO</i> or <i>Debt</i>.</p>
      {!emailReady() && <p className="fine" style={{ margin: "0 0 12px", color: "#b42318" }}><b>Sending is not set up on this site</b>, so approving an email cannot send it. Add RESEND_API_KEY (and EMAIL_FROM, for example Before the Bell &lt;desk@beforethebell.in&gt;) in Vercel&apos;s environment variables and redeploy.</p>}
      {edit && count("drafted") > 0 && <form action={approveAllProspectEmails} style={{ margin: "0 0 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="back" value={back} />
        <button className="btn sm primary" type="submit">Approve and send all {count("drafted")} drafts</button>
        <span className="fine">Approves every email at Draft ready as written. Up to 15 go at once in sending hours; the rest go from 9 AM on working days, up to 40 a day.</span></form>}
      <div className="adm-filter">{[["open", `Open (${all.filter((p) => OPEN.includes(p.status)).length})`], ...PROSPECT_STATUS.map((x) => [x.id, `${x.label} (${count(x.id)})`]), ["all", `All (${all.length})`]].map(([k, l]) =>
        <a key={k} href={q({ status: k })} className={status === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter">{[["", "Equity and debt"], ["equity", "Pre-IPO equity"], ["debt", "Debt"]].map(([k, l]) =>
        <a key={k} href={q({ kind: k })} className={kind === k ? "on" : ""}>{l}</a>)}</div>
      <form action="/admin/sourcing" className="adm-filter" role="search" style={{ alignItems: "center" }}>
        {Object.entries({ status: status !== "open" ? status : "", kind, sort: sort !== "active" ? sort : "", reach, resp, rev }).filter(([, v]) => v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="search" name="s" defaultValue={find} placeholder="Search: company, sector, city, contact…" aria-label="Search companies" style={{ flex: "1 1 240px", maxWidth: 380 }} />
        <button className="btn sm" type="submit">Search</button>
        {find && <a href={q({ s: "" })}>Clear</a>}
      </form>
      <div className="adm-filter" style={{ alignItems: "center" }}><span className="fine">Sort</span>{SORTS.map(([k, l]) => <a key={k} href={q({ sort: k })} className={sort === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter">{REACH.map(([k, l]) => <a key={`r${k}`} href={q({ reach: k })} className={reach === k ? "on" : ""}>{l}</a>)}
        <span className="fine" style={{ margin: "0 4px" }}>·</span>{RESP.map(([k, l]) => <a key={`p${k}`} href={q({ resp: k })} className={resp === k ? "on" : ""}>{l}</a>)}</div>
      <div className="adm-filter">{BANDS.map(([k, l]) => <a key={`b${k}`} href={q({ rev: k })} className={rev === k ? "on" : ""}>{l}</a>)}</div>
      <p className="fine" style={{ margin: "0 0 10px" }}>{list.length} compan{list.length === 1 ? "y" : "ies"}{sort === "active" ? ", most active first: replies, then link clicks and opens of the desk's emails, then the most recently emailed" : ""}. A company that replies with interest moves to the deal pipeline on its own, with its call task.</p>
      {list.length ? <div className="cmpwrap"><table className="cmp plain src-t"><thead><tr><th>Company</th><th>Revenue</th><th>PAT</th><th>Growth</th><th>Need</th><th>Why it fits</th><th>Contact</th><th>Stage</th>{edit && <th />}</tr></thead><tbody>
        {list.map((p) => (
          <tr key={p.id}>
            <td className="atb-co"><b>{p.company}</b><small className="fine" style={{ display: "block" }}>{[p.sector, p.city, p.fy].filter(Boolean).join(" · ")}</small>
              {p.rating && <small className="fine" style={{ display: "block" }}>{p.rating}</small>}
              {p.website && <small style={{ display: "block" }}><a href={p.website} target="_blank" rel="noopener noreferrer">Website</a></small>}</td>
            <td>{cr(p.revenueCr)}</td><td>{cr(p.patCr)}</td><td>{p.growthPct == null ? "—" : `${p.growthPct}%`}</td><td>{KIND[p.kind] ?? p.kind}</td>
            <td style={{ maxWidth: 460, minWidth: 360 }}><span className="fine">{p.why || "—"}</span>
              {p.signals.length > 0 && <small className="fine" style={{ display: "block", marginTop: 4 }}>{p.signals.join(" · ")}</small>}
              {p.sources.length > 0 && <small style={{ display: "block", marginTop: 4 }}>{p.sources.map((x, i) => <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" style={{ marginRight: 8 }}>{x.title || `Source ${i + 1}`}</a>)}</small>}
              {(p.emailBody || p.status === "new") && <details className="src-mail" open={p.status === "drafted"}>
                <summary>{p.status === "drafted" ? (p.sends ? "Follow-up email to review" : "Email to review") : p.status === "approved" ? "Approved email, goes at 9 AM" : p.emailBody ? `Email${p.sends ? ` (sent ${p.sends}×)` : ""}` : "Write an email"}</summary>
                {edit && (p.status === "new" || p.status === "drafted") ? <form action={saveProspectEmail} className="form">
                  <input type="hidden" name="company" value={p.company} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} />
                  <div className="row"><label>To<input name="contactEmail" type="email" defaultValue={p.contactEmail ?? ""} maxLength={200} /></label><label>Name<input name="contactName" defaultValue={p.contactName ?? ""} maxLength={120} /></label></div>
                  <label>Subject<input name="emailSubject" defaultValue={p.emailSubject ?? ""} maxLength={300} /></label>
                  <label>Email<textarea name="emailBody" rows={9} maxLength={3000} defaultValue={p.emailBody ?? ""} /><span className="hint">Plain text. The desk sign-off and an opt-out line are added when it is sent.</span></label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn sm" type="submit">Save</button>
                    {p.status === "drafted" && <button className="btn sm primary" type="submit" formAction={approveProspectEmail}>Approve and send from the desk</button>}</div>
                  <p className="fine" style={{ margin: 0 }}>Sent from desk@beforethebell.in, Monday to Saturday, 9 AM to 7 PM. Approved outside those hours, it goes at 9 AM.</p>
                </form> : <div className="fine"><p style={{ margin: "6px 0" }}><b>{p.emailSubject}</b>{p.contactEmail ? ` · to ${p.contactEmail}` : ""}{p.approvedBy ? ` · approved by ${p.approvedBy}` : ""}</p><pre style={{ whiteSpace: "pre-wrap", margin: 0, font: "inherit" }}>{p.emailBody}</pre></div>}
              </details>}
              {p.notes && <details style={{ marginTop: 4 }}><summary className="fine">Notes</summary><pre className="fine" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.notes}</pre></details>}</td>
            <td>{p.contactName || "—"}{p.contactRole ? <small className="fine" style={{ display: "block" }}>{p.contactRole}</small> : null}{p.contactEmail ? <small className="mono" style={{ display: "block" }}>{p.contactEmail}</small> : null}</td>
            <td><span className={`pill ${p.status === "interested" || p.status === "added" ? "ok" : p.status === "declined" || p.status === "passed" ? "off" : ""}`}>{prospectLabel(p.status)}</span>
              {(() => { const a = act.get(p.id)!; return <small style={{ display: "block", marginTop: 4, fontWeight: a.tone ? 600 : 400, color: a.tone === "ok" ? "var(--ok, #1e7d4f)" : a.tone === "mid" ? "#b26a00" : a.tone === "off" ? "#b42318" : undefined }} className={a.tone ? "" : "fine"}>{a.label}</small>; })()}
              <small className="fine" style={{ display: "block" }}>Found {fmtT(p.createdAt)}</small>
              {p.taskId ? <small style={{ display: "block" }}><a href="/admin/tasks">Call task{p.assigneeId ? `: ${who.get(p.assigneeId) ?? ""}` : ""}</a></small> : null}
              {p.dealId ? <small style={{ display: "block" }}><a href={p.kind === "debt" ? `/admin/debt/${p.dealId}` : `/admin/deals/${p.dealId}`}>Open the deal</a></small> : null}</td>
            {edit && <td style={{ minWidth: 190 }}>
              <form action={setProspect} className="src-f"><input type="hidden" name="company" value={p.company} /><input type="hidden" name="back" value={back} />
                <select name="status" defaultValue={p.status} aria-label="Stage">{PROSPECT_STATUS.filter((x) => x.id !== "added" && x.id !== "approved").map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                <input name="note" maxLength={1000} placeholder="Note (optional)" aria-label="Note" />
                <button className="btn sm" type="submit">Save</button></form>
              {!p.dealId && <form action={prospectToDeal} className="src-f" style={{ marginTop: 6 }}><input type="hidden" name="id" value={p.id} />
                <button className="btn sm primary" name="as" value="equity" type="submit">Pre-IPO</button>
                <button className="btn sm primary" name="as" value="debt" type="submit">Debt</button></form>}
            </td>}
          </tr>))}
      </tbody></table></div> : <p className="fine">{all.length ? "Nothing here with these filters." : "Nothing yet. The assistant adds companies each weekday morning."}</p>}
      {edit && <div className="chart" style={{ marginTop: 22 }} id="add"><span className="k">Add a company by hand</span>
        <form action={addProspectByHand} className="form">
          <div className="row"><label>Company<input name="company" required maxLength={200} /></label><label>Need<select name="kind" defaultValue="equity"><option value="equity">Pre-IPO equity</option><option value="debt">Debt</option><option value="both">Equity or debt</option></select></label></div>
          <div className="row"><label>Sector<input name="sector" maxLength={120} /></label><label>City<input name="city" maxLength={80} /></label></div>
          <div className="row"><label>Revenue (₹ crore)<input name="revenueCr" inputMode="decimal" /></label><label>PAT (₹ crore)<input name="patCr" inputMode="decimal" /></label></div>
          <div className="row"><label>Contact name<input name="contactName" maxLength={120} /></label><label>Contact email<input name="contactEmail" type="email" maxLength={200} /></label></div>
          <label>Website<input name="website" type="url" maxLength={300} placeholder="https://" /></label>
          <label>Why it fits<textarea name="why" rows={2} maxLength={1500} /></label>
          <div><button className="btn primary" type="submit">Add to Sourcing</button></div></form></div>}
    </>
  );
}
