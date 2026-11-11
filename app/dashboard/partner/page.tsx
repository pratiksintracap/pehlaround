import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listDeals, canSeeNames } from "@/lib/deals";
import { partnerBook } from "@/lib/partner";
import { fmtCr, progress, tally } from "@/lib/partner-math";
import { officeRefCode, userRefCode } from "@/lib/track";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Partner desk", robots: { index: false } };

const fmtD = (d: Date | null) => d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const AP: Record<string, [string, string]> = { approved: ["Approved", "ok"], rejected: ["On hold", ""], pending: ["Awaiting approval", "mid"] };

/** The partner desk: a partner firm's issues, targets, relationship managers and clients (MODEL.md §6, Partners). */
export default async function PartnerDesk() {
  const user = await requireUser("/dashboard/partner");
  const book = await partnerBook(user);
  if (!book || !user.office) redirect("/dashboard");
  const office = user.office;
  const names = await canSeeNames(user);
  const deals = (await listDeals()).filter((d) => d.phase !== "closed" || book.ndas.some((n) => n.dealId === d.id));
  const byId = new Map((await listDeals()).map((d) => [d.id, d]));
  const label = (id: number) => { const d = byId.get(id); return d ? (names ? d.company : d.title) : ""; };
  // Links: the firm's own (a principal) and each person's. A client who registers through a person's link is theirs.
  const approved = office.approval === "approved";
  const firmCode = approved && book.admin ? await officeRefCode(office.id, office.refCode) : null;
  const myCode = approved ? await userRefCode(user.id, user.refCode) : null;
  const total = tally(book.clients, book.ndas, book.asks);
  const target = (dealId: number, leg: string) => book.targets.find((t) => t.dealId === dealId && t.leg === leg);
  const rmName = new Map(book.people.map((p) => [p.id, p.name]));
  const share = (url: string, text: string) => (
    <div className="dl-acts"><input readOnly value={url} aria-label="Link" /><button type="button" className="btn sm" data-copy={url}>Copy</button>
      <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener">WhatsApp</a></div>);

  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <p className="crumb"><a href="/dashboard">← Back to your dashboard</a></p>
      <span className="eyebrow">Partner desk{book.admin ? "" : " · your clients"}</span>
      <h1>{office.name}</h1>
      {!approved && <p className="notice">The desk is reviewing your firm. Your links work once it is approved.</p>}

      <div className="pf-sum" style={{ marginTop: 14 }}>
        <div><span className="k">Clients</span><b>{total.clients}</b><small>{total.approved} approved by the desk</small></div>
        <div><span className="k">Introductions</span><b>{total.intros}</b><small>clients that signed a company&apos;s NDA</small></div>
        <div><span className="k">Requested</span><b>{fmtCr(total.indicatedCr)}</b><small>{fmtCr(total.allottedCr)} allotted</small></div>
      </div>

      {approved && <div className="chart" style={{ marginTop: 14 }}>
        <span className="k">Your links</span>
        <p className="fine">A client who registers through a link is tagged to it and told so. They see the same companies, decks and data rooms as every approved investor, and sign each NDA themselves.</p>
        {myCode && <><p style={{ margin: "8px 0 4px" }}><b>{book.admin ? "Your own link" : "Your link"}</b> <small className="fine">clients are credited to you, {user.name}</small></p>
          {share(`${SITE_URL}/register?ref=${myCode}`, "Pre-IPO companies, vetted before you see them. Register here:")}</>}
        {firmCode && <><p style={{ margin: "12px 0 4px" }}><b>The firm&apos;s link</b> <small className="fine">credited to {office.name}, not to one person</small></p>
          {share(`${SITE_URL}/register?ref=${firmCode}`, "Pre-IPO companies, vetted before you see them. Register here:")}</>}
      </div>}

      <h2 style={{ fontSize: 22, marginTop: 28 }}>Issues</h2>
      <p className="fine">{book.admin ? "The desk sets a target for your firm on each issue." : "Targets are your firm's; the progress shown is from your own clients."} An introduction is a client that signed that company&apos;s NDA.</p>
      <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Issue</th><th>Target</th><th>Introductions</th><th>Requested</th><th>Allotted</th><th>Link for this issue</th></tr></thead><tbody>
        {deals.length ? deals.map((d) => { const t = target(d.id, "pre_ipo"), c = tally(book.clients, book.ndas, book.asks, d.id), p = progress(t, c); const url = myCode ? `${SITE_URL}/deals/${d.slug}?ref=${myCode}` : null; return (
          <tr key={d.id}><th scope="row">{names ? d.company : d.title}<br /><small className="fine">{d.category} · {d.phase === "open" ? "Open" : d.phase === "closed" ? "Round closed" : "Announced"}</small></th>
            <td>{t ? <>{[t.intros ? `${t.intros} introductions` : "", t.amountCr ? fmtCr(t.amountCr) : ""].filter(Boolean).join(" · ") || "—"}
              {p !== null && <i className="as-meter" style={{ marginTop: 6, minWidth: 90 }} aria-label={`${Math.round(p * 100)}% of target`}><i style={{ width: `${Math.round(p * 100)}%` }} /></i>}
              {t.note && <><br /><small className="fine">{t.note}</small></>}</> : <small className="fine">Not set</small>}</td>
            <td>{c.intros}</td><td>{c.indicatedCr ? fmtCr(c.indicatedCr) : "—"}</td><td>{c.allottedCr ? fmtCr(c.allottedCr) : "—"}</td>
            <td>{url && d.phase !== "closed" ? <span style={{ display: "flex", gap: 6 }}><button type="button" className="btn sm" data-copy={url}>Copy</button>
              <a className="btn sm" href={`https://wa.me/?text=${encodeURIComponent(`${d.title}. ${d.headline} ${url}`)}`} target="_blank" rel="noopener">WhatsApp</a></span> : "—"}</td></tr>); })
          : <tr><td colSpan={6} className="fine">No issues on the desk right now.</td></tr>}
      </tbody></table></div>
      <p className="fine">The link opens the anonymised overview; the company&apos;s name and deck open once the desk approves the client. Never send a company&apos;s name or documents yourself: each company may be offered to a limited number of identified people.</p>

      {book.admin && <>
        <h2 style={{ fontSize: 22, marginTop: 28 }}>Relationship managers</h2>
        <p className="fine">Everyone at your firm. Add people under <a href="/dashboard#Team">Team</a>; each gets a link of their own here, and sees only the clients they introduced.</p>
        <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Person</th><th>Clients</th><th>Approved</th><th>Introductions</th><th>Requested</th><th>Allotted</th></tr></thead><tbody>
          {book.people.map((p) => { const c = tally(book.clients.filter((x) => x.rmId === p.id), book.ndas, book.asks); return (
            <tr key={p.id}><th scope="row">{p.name}<br /><small className="fine">{p.email}{/commit/i.test(p.rights) ? " · principal" : ""}</small></th>
              <td>{c.clients}</td><td>{c.approved}</td><td>{c.intros}</td><td>{c.indicatedCr ? fmtCr(c.indicatedCr) : "—"}</td><td>{c.allottedCr ? fmtCr(c.allottedCr) : "—"}</td></tr>); })}
          {(() => { const c = tally(book.clients.filter((x) => !x.rmId || !rmName.has(x.rmId)), book.ndas, book.asks); return c.clients ? (
            <tr><th scope="row">The firm&apos;s link<br /><small className="fine">not credited to one person</small></th><td>{c.clients}</td><td>{c.approved}</td><td>{c.intros}</td><td>{c.indicatedCr ? fmtCr(c.indicatedCr) : "—"}</td><td>{c.allottedCr ? fmtCr(c.allottedCr) : "—"}</td></tr>) : null; })()}
        </tbody></table></div></>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>Clients</h2>
        {book.clients.length > 0 && <a className="btn sm" href="/api/office/partner/statement">Download statement (CSV)</a>}
      </div>
      <p className="fine">You see which companies a client signed an NDA for and the allocations it asked for. Its documents, questions and notes stay private to it.</p>
      {book.clients.length ? <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Client</th>{book.admin && <th>Introduced by</th>}<th>Status</th><th>NDAs signed</th><th>Allocations requested</th></tr></thead><tbody>
        {book.clients.map((c) => { const n = book.ndas.filter((x) => x.officeId === c.id), a = book.asks.filter((x) => x.officeId === c.id && x.status !== "Withdrawn"); const [ap, tone] = AP[c.approval] ?? AP.pending; return (
          <tr key={c.id}><th scope="row">{c.name}<br /><small className="fine">Joined {fmtD(c.createdAt)}</small></th>
            {book.admin && <td>{(c.rmId && rmName.get(c.rmId)) || "The firm's link"}</td>}
            <td><span className={`pill ${tone}`}>{ap}</span></td>
            <td>{n.length ? n.map((x) => label(x.dealId)).filter(Boolean).join(", ") : "—"}</td>
            <td>{a.length ? a.map((x) => `${label(x.dealId)}: ₹${Number(x.amountCr)} Cr (${x.status})`).join(" · ") : "—"}</td></tr>); })}
      </tbody></table></div>
        : <div className="chart"><p>No clients yet. Send {book.admin ? "a link above" : "your link above"} to the people you advise; when they register through it, they appear here.</p></div>}
      <p className="fine" style={{ marginTop: 18 }}>Your terms with the desk are in your partner agreement. Every offer is made by the company privately to identified investors under applicable law.</p>
    </div></main>
  );
}
