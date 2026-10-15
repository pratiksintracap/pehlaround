import type { Metadata } from "next";
import { pageMeta, faqLd, crumbsLd, ld } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

// The evergreen guide: what someone searching "pre-IPO investing in India" needs to know before buying unlisted
// shares. Written as reference, not marketing; the desk appears only at the end. Facts are kept general and
// pointed at the documents (DRHP, offer letter) and the investor's own CA, since rules change.
const PATH = "/pre-ipo-investing";
const TITLE = "Pre-IPO investing in India: a guide for investors";
const DESC = "How pre-IPO investing works in India: primary and secondary rounds, who can invest, lock-in after listing, tax, what to check before you sign, and the risks.";
const UPDATED = "2026-10-15";

export const metadata: Metadata = pageMeta({ path: PATH, title: TITLE, description: DESC, type: "article", publishedTime: "2026-10-15T09:00:00+05:30", modifiedTime: `${UPDATED}T09:00:00+05:30`, authors: ["Before the Bell team"] });

const FAQ = `<div class="faq">
<details><summary>Can an individual invest in a pre-IPO company in India?</summary><p>Yes. A resident individual can buy shares of an unlisted company, either through a private placement by the company or by buying from an existing shareholder. The company can make a private placement offer only to identified investors, so you are approached, or you register with someone who arranges the round. Ticket sizes in genuine pre-IPO rounds usually start in the tens of lakhs.</p></details>
<details><summary>How do I receive pre-IPO shares?</summary><p>In your demat account. Unlisted public companies have had to issue shares only in demat form since 2018, and most private companies now must as well. A primary round ends with an allotment by the company (form PAS-3 is filed); a secondary purchase ends with a transfer from the seller's demat to yours.</p></details>
<details><summary>Are pre-IPO shares locked in after the IPO?</summary><p>Usually, yes. On the main board, shares held by non-promoter shareholders before the IPO are generally locked in for six months from the date of allotment in the IPO. Promoters carry longer lock-ins. The draft red herring prospectus (DRHP) states the exact lock-in for each class of holder, so read it before you count on an exit date.</p></details>
<details><summary>How are pre-IPO gains taxed?</summary><p>While the company is unlisted, gains on shares held for more than 24 months are long-term and, for transfers from 23 July 2024, taxed at 12.5% without indexation; shorter holdings are taxed at your slab rate. Once the shares are listed and sold on the exchange, the listed-equity rules generally apply. The holding period counts from the day you bought. Take your CA's advice on your own case.</p></details>
<details><summary>What happens if the IPO is delayed or never happens?</summary><p>You hold unlisted shares with no ready market. Exits then come from a later funding round, a buyback, a sale to a strategic buyer or another investor, or a listing at a later date. This is the central risk of pre-IPO investing, and the reason to size each position so a delay does not hurt.</p></details>
<details><summary>Are online unlisted-share platforms the same as a pre-IPO round?</summary><p>No. SEBI has cautioned that websites dealing in unlisted securities of public companies are not authorised to do so. A private placement is a different route: the company itself issues shares to identified investors under the Companies Act, with an offer letter, a board and shareholder approval, and filings with the Registrar of Companies.</p></details>
</div>`;

const BODY = `
<p>Pre-IPO investing means buying shares of a company before it lists on a stock exchange. Done well, it is how the largest part of a listing's gain is made: the price an early investor pays is set by a private negotiation, not by a book-built IPO that has already priced in the story. Done badly, it means paying listed-company prices for an unlisted share you cannot sell. This guide covers how it works in India and what to check before you sign.</p>

<h2>Primary and secondary: two ways in</h2>
<p><b>A primary round</b> is new shares issued by the company. Your money goes to the company to fund growth, usually by a preferential allotment through a private placement under sections 42 and 62 of the Companies Act, 2013. The company needs board and shareholder approval, issues a private placement offer letter, takes the money into a separate bank account and files the allotment with the Registrar of Companies.</p>
<p><b>A secondary</b> is buying existing shares from a shareholder: a founder, an early investor or an employee. The money goes to the seller, not the company, under a share purchase agreement, and the shares move from the seller's demat to yours. Secondaries are common in the year before an IPO, when early holders want liquidity.</p>
<p>Neither is better in itself. A primary tells you the company needs capital and what for; a secondary tells you someone is selling, and the useful question is why.</p>

<h2>Who can invest, and how many</h2>
<p>A private placement can be offered to at most 200 persons in a financial year, not counting qualified institutional buyers and employees under an ESOP. The offer has to be made to identified people; a company cannot advertise it to the public. That is why genuine pre-IPO rounds are arranged privately, and why their minimum tickets are usually ₹25 lakh or more: a round has to fill within that 200-person limit.</p>
<p>Family offices, AIFs with an unlisted mandate, PMS and individual investors all take part. Non-residents can invest too, subject to the foreign exchange rules for the company's sector.</p>

<h2>What to check before you sign</h2>
<ul>
<li><b>Revenue and profit today.</b> Audited numbers for at least three years, reconciled with GST returns and bank statements. A pre-IPO company that is still losing money is a venture bet, priced like one or not at all.</li>
<li><b>The entry price against listed peers.</b> Compare the round's price-to-earnings and EV/EBITDA with listed companies in the same business. If the entry is already at or above the peers, the IPO has little left to pay you.</li>
<li><b>The path to listing.</b> Is a merchant banker appointed? Is the DRHP drafted or filed? Main board or SME platform? Which financial year's numbers will the IPO be based on? A path you can date is worth more than a promise.</li>
<li><b>Use of the money.</b> In a primary, what it funds and whether that changes the earnings the IPO will be priced on.</li>
<li><b>Shareholding and title.</b> Who owns what, whether the shares are in demat, whether any are pledged, and, in a secondary, that the seller actually holds clean title.</li>
<li><b>Related parties and governance.</b> Sales or purchases routed through promoter entities, loans to directors, and the quality of the auditor.</li>
<li><b>Your rights.</b> What the shareholders' agreement gives you: information rights, tag-along, and what happens if the IPO does not take place by a date.</li>
</ul>

<h2>Lock-in after the listing</h2>
<p>Under SEBI's ICDR regulations, shares held before the IPO are locked in after listing. For most non-promoter investors on the main board, that is six months from the IPO allotment; promoters' minimum contribution is locked in for longer. Plan your exit from the end of the lock-in, not from the listing day, and read the exact terms in the DRHP.</p>

<h2>Tax, in outline</h2>
<p>While the company is unlisted, shares held for more than 24 months give long-term gains, taxed at 12.5% without indexation for transfers from 23 July 2024; shorter holdings are taxed at your slab rate. After listing, gains on shares sold on the exchange generally follow the listed-equity rules: long-term after 12 months, at 12.5% above the annual exemption. The holding period runs from the day you bought. Rules change with each Budget, so confirm with your CA.</p>

<h2>The risks, plainly</h2>
<ul>
<li><b>Illiquidity.</b> Until the listing, there is no market for your shares.</li>
<li><b>Delay.</b> IPOs slip by quarters or years with market conditions, audits and approvals.</li>
<li><b>Price at listing.</b> An IPO can be priced below the last private round, especially after a market fall.</li>
<li><b>Information.</b> You know only what the company and the arranger tell you. Insist on the documents and verify what you can.</li>
<li><b>Total loss.</b> Unlisted companies can fail. Size every position so that one failure does not matter.</li>
</ul>

<h2>Where Before the Bell fits</h2>
<p>Before the Bell is a desk for this kind of investing. It brings profitable, IPO-bound Indian companies that are not already doing the rounds, visits and vets each one before investors see it, and puts its own capital into every company it brings. Approved investors see each company by name with its pitch deck, sign that company's NDA on screen, and open a data room with the numbers, the terms, the path to listing and the risks as the desk sees them. <a href="/how-it-works">See how it works</a> or <a href="/deals">look at the deals on the desk</a>.</p>
`;

export default function Guide() {
  const faq = faqLd(FAQ);
  const article = { "@context": "https://schema.org", "@type": "Article", headline: TITLE, description: DESC, inLanguage: "en-IN",
    datePublished: "2026-10-15", dateModified: UPDATED, image: [`${SITE_URL}/og.jpg`], mainEntityOfPage: SITE_URL + PATH,
    author: { "@type": "Organization", name: "Before the Bell", url: SITE_URL }, publisher: { "@id": `${SITE_URL}/#org` } };
  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <p className="crumb"><a href="/">← Before the Bell</a></p>
      <article className="art">
        <span className="eyebrow">Guide · Updated 15 October 2026</span>
        <h1>{TITLE}</h1>
        <p className="lede">Primary and secondary rounds, who can invest, lock-in, tax, what to check before you sign, and the risks.</p>
        <div className="art-body" dangerouslySetInnerHTML={{ __html: BODY }} />
        <h2 style={{ marginTop: 36 }}>Questions investors ask</h2>
        <div dangerouslySetInnerHTML={{ __html: FAQ }} />
        <p style={{ marginTop: 28 }}><a className="btn primary" href="/register">Register to see the companies</a></p>
        <p className="fine" style={{ marginTop: 18 }}>For information only. Not an offer, advice or a recommendation to buy or sell any security. Laws and tax rates change; take advice on your own position.</p>
      </article>
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(article)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd([["Home", "/"], ["Pre-IPO investing in India", PATH]]))} />
    </div></main>
  );
}
