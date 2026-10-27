import type { Metadata } from "next";
import { pageMeta, crumbsLd, faqLd, ld } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { calendar, fmtDay, istToday, IPO_DATA, type Ipo } from "@/lib/ipo-calendar";

// The IPO calendar: what is open, opening, waiting to list and recently listed, main board and SME.
// Dates and terms as the issuers filed them; no view on any issue. It brings in people searching for IPOs, and points
// them to the step before the IPO: companies on the desk.
export const revalidate = 3600;
const PATH = "/ipo-calendar";
const TITLE = "IPO calendar: upcoming main-board and SME IPOs this week";
const DESC = "Every IPO open now and opening this week on NSE and BSE, main board and SME: dates, price band, issue size, lot, allotment and listing day. Updated every week.";

export const metadata: Metadata = pageMeta({ path: PATH, title: TITLE, description: DESC, modifiedTime: `${IPO_DATA.asOf}T09:00:00+05:30` });

const FAQ: [string, string][] = [
  ["How do I apply for an IPO in India?", "Through your broker's app or your bank's net banking, using UPI or ASBA, while the issue is open. The money is blocked, not debited, until allotment. You bid in lots; the price band and lot size are set by the company before the issue opens."],
  ["What is the difference between a main-board and an SME IPO?", "Main-board issues list on the NSE and BSE main boards. SME issues list on NSE Emerge or BSE SME, are smaller, and carry larger minimum applications, typically two lots for an individual. SME shares trade in lots and can be less liquid."],
  ["When do IPO shares reach my demat?", "Allotment is usually finalised the working day after the issue closes, shares are credited the day after, and listing follows on the third working day after closing (T+3)."],
  ["Can I invest before the IPO?", "Yes, in a pre-IPO round: a private placement or a secondary purchase while the company is still unlisted. These are arranged privately, usually with higher minimum tickets, and the shares are typically locked in for six months after listing."],
];

function Table({ rows, cols }: { rows: Ipo[]; cols: ("dates" | "listing" | "terms")[] }) {
  return (
    <div className="cmpwrap"><table className="cmp plain ipo-t"><thead><tr><th>Company</th><th>Board</th>
      {cols.includes("dates") && <th>Open – close</th>}{cols.includes("terms") && <><th>Price band</th><th>Issue size</th></>}
      {cols.includes("listing") && <th>Listing</th>}</tr></thead><tbody>
      {rows.map((i) => (
        <tr key={i.name}><th scope="row">{i.name}</th><td>{i.board === "SME" ? "SME" : "Main board"}{i.exchange ? <small className="fine"><br />{i.exchange}</small> : null}</td>
          {cols.includes("dates") && <td>{fmtDay(i.open)} – {fmtDay(i.close)}</td>}
          {cols.includes("terms") && <><td>{i.band ?? "—"}{i.lot ? <small className="fine"><br />lot {i.lot.toLocaleString("en-IN")}</small> : null}</td><td>{i.sizeCr ? `₹${i.sizeCr.toLocaleString("en-IN")} Cr` : "—"}</td></>}
          {cols.includes("listing") && <td>{fmtDay(i.listing)}{i.allotment && cols.includes("dates") ? <small className="fine"><br />allotment {fmtDay(i.allotment)}</small> : null}</td>}
        </tr>))}
    </tbody></table></div>
  );
}

export default function IpoCalendar() {
  const today = istToday();
  const c = calendar(today);
  const list = [...c.open, ...c.soon, ...c.closed];
  const itemLd = { "@context": "https://schema.org", "@type": "ItemList", name: TITLE, url: `${SITE_URL}${PATH}`, numberOfItems: list.length,
    itemListElement: list.map((i, n) => ({ "@type": "ListItem", position: n + 1, name: `${i.name} IPO (${i.board === "SME" ? "SME" : "main board"}), ${fmtDay(i.open)} to ${fmtDay(i.close)}` })) };
  return (
    <main><div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd([["Home", "/"], ["IPO calendar", PATH]]))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(itemLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(faqLd(FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("")))} />
      <section className="sec tight">
        <span className="eyebrow">IPO calendar · updated {fmtDay(IPO_DATA.asOf)}</span>
        <h1>IPOs this week: main board and SME</h1>
        <p className="note">Every issue open now or opening soon on the NSE and BSE, with its dates and terms as filed, and the ones that listed in the last month. Facts only: Before the Bell takes no view on any of these issues.</p>
      </section>

      <section className="sec tight ipo-sec"><h2>Open now <small className="fine">{c.open.length}</small></h2>
        {c.open.length ? <Table rows={c.open} cols={["dates", "terms", "listing"]} /> : <p className="fine">No issue is open today.</p>}</section>
      <section className="sec tight ipo-sec"><h2>Opening soon <small className="fine">{c.soon.length}</small></h2>
        {c.soon.length ? <Table rows={c.soon} cols={["dates", "terms", "listing"]} /> : <p className="fine">No issue has announced its dates yet.</p>}</section>
      {c.closed.length > 0 && <section className="sec tight ipo-sec"><h2>Closed, listing soon</h2><Table rows={c.closed} cols={["dates", "terms", "listing"]} /></section>}
      {c.listed.length > 0 && <section className="sec tight ipo-sec"><h2>Listed in the last month</h2><Table rows={c.listed} cols={["listing"]} /></section>}

      <section className="sec tight">
        <div className="chart ipo-cta"><span className="k">Before the IPO</span>
          <h2 style={{ fontSize: 22, margin: "6px 0" }}>The price on this page is the IPO price. Earlier rounds are priced before it.</h2>
          <p>Before the Bell brings profitable Indian companies to family offices and serious investors a year or two before they list: diligence done, data room under NDA, the desk&apos;s own capital in every deal.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn primary" href="/deals">See the companies before they list</a><a className="btn ghost" href="/pre-ipo-investing">How pre-IPO investing works</a></div>
        </div>
        <div className="chart ipo-cta" style={{ marginTop: 12 }}><span className="k">Planning your own listing?</span>
          <p>The year before filing is when a pre-IPO round does the most for a company: it funds the growth the IPO is priced on, and the investors who come in early become part of the story. <a href="/raise/pre-ipo-funding">How to raise a pre-IPO round</a> · <a href="/raise/sme-ipo-vs-main-board">SME IPO or main board</a> · <a href="/founders">Tell the desk about your company</a></p>
        </div>
      </section>

      <section className="sec tight"><h2>Questions</h2>
        <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
        <p className="fine" style={{ marginTop: 16 }}>Dates are tentative until the registrar and exchange confirm them. This page is for information only; read the red herring prospectus before applying. Sources: {IPO_DATA.sources.map((s, n) => <span key={s.url}>{n ? ", " : ""}<a href={s.url} rel="nofollow noopener" target="_blank">{s.title}</a></span>)}.</p>
      </section>
    </div></main>
  );
}
