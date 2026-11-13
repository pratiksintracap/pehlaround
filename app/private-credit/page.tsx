import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell } from "@/components/credit/CreditBits";
import { HeroNetwork } from "@/components/credit/diagrams";
import { GlyphCycles, GlyphDiligence, GlyphMatch, GlyphSellDown } from "@/components/credit/glyphs";

// The debt desk's front page, for companies that need to borrow: term loans, working capital, NCDs, CP, acquisition
// finance, refinancing and structured credit. Nothing about any borrower, lender, rate or amount is public.
const D = "Debt for growing Indian companies, arranged by the desk: term loans, working capital, NCDs, commercial paper, acquisition finance, refinancing and structured credit, taken to the banks, NBFCs and credit funds that fit.";
export const metadata: Metadata = pageMeta({ path: CREDIT_BASE, title: "Debt desk: loans and structured credit for companies", description: D });

const FACILITIES: [string, string][] = [
  ["Term loans and capex", "Plant, capacity and expansion, with tenor matched to the asset."],
  ["Working capital", "Cash credit, WCDL, bill discounting and supply-chain lines."],
  ["NCDs and commercial paper", "Listed or unlisted NCDs and CP programmes, placed with institutions."],
  ["Acquisition finance", "Funding to buy a company, a stake or an asset, including under IBC."],
  ["Refinancing", "Replacing costlier or shorter debt with a facility that fits the cash flows."],
  ["Loans against shares or property", "For promoters and holding companies, against listed shares or real estate."],
  ["Structured and mezzanine credit", "When senior debt alone does not fit: cash-flow-backed, convertible or bridge structures."],
  ["Funding lines for NBFCs", "Secured term lines and recurring drawdowns for smaller NBFCs."],
];

export default function DebtDesk() {
  return (
    <CreditShell here="">
      <section className="cr-hero"><div className="wrap cr-hero-in">
        <div>
          <p className="cr-kick">Debt desk · for companies that need to borrow</p>
          <h1>Debt for growing companies, <em>arranged by the desk.</em></h1>
          <p className="cr-lede">Tell the desk what you need. It prepares the credit pack, structures the facility and takes it to the banks, NBFCs and credit funds that lend in your sector and size, so you compare real term sheets instead of chasing lenders one at a time.</p>
          <div className="cr-ctas"><a className="btn primary" href={`${CREDIT_BASE}/request-access?as=company`}>Tell us what you need</a><a className="btn ghost" href={`${CREDIT_BASE}/how-it-works`}>How it works</a></div>
        </div>
        <figure className="cr-fig" style={{ margin: 0 }}><HeroNetwork /></figure>
      </div></section>

      <section className="cr-sec"><div className="wrap">
        <div className="cr-head"><h2>What the desk arranges</h2><p>Secured and structured debt for profitable, growing companies, listed or unlisted, and for their promoters.</p></div>
        <ul className="cr-facs" data-reveal>{FACILITIES.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ul>
      </div></section>

      <section className="cr-sec alt"><div className="wrap">
        <div className="cr-head"><h2>Why companies use the desk</h2></div>
        <ul className="cr-caps" data-reveal>
          <li><GlyphDiligence /><div><h3>A credit pack lenders can act on</h3><p>The desk turns your numbers, security and plans into the information lenders ask for, before the first call, so credit teams can say yes or no quickly.</p></div></li>
          <li><GlyphMatch /><div><h3>Only the lenders that fit</h3><p>Each lender has a sector, a ticket range and a view on security. The desk goes only to those your requirement fits, and never sprays your file around the market.</p></div></li>
          <li><GlyphSellDown /><div><h3>One requirement, several lenders</h3><p>A larger facility can be split across lenders on the same terms, and you see competing term sheets side by side.</p></div></li>
          <li><GlyphCycles /><div><h3>The next tranche starts from the same file</h3><p>Renewals, top-ups and the next round of capex build on the work already done, with lenders who already know the company.</p></div></li>
        </ul>
      </div></section>

      <section className="cr-sec"><div className="wrap">
        <div className="cr-head"><h2>How it works</h2><p>From the first call to disbursement.</p></div>
        <ol className="cr-steps" data-reveal>
          <li><h3>Your requirement</h3><p>Amount, purpose, tenor you want and the security you can offer.</p></li>
          <li><h3>Credit pack</h3><p>The desk reviews the numbers and prepares the information lenders need.</p></li>
          <li><h3>Lender match</h3><p>Shared only with the lenders that fit your sector, size and security.</p></li>
          <li><h3>Term sheets</h3><p>Lenders run their own credit review; you compare rate, tenor and covenants.</p></li>
          <li><h3>Sanction and disbursement</h3><p>The desk stays with you through documents and the first drawdown.</p></li>
        </ol>
        <p className="fine" style={{ marginTop: 16 }}><a href={`${CREDIT_BASE}/how-it-works`}>See each step in detail →</a></p>
      </div></section>

      <section className="cr-sec cr-dark" id="confidential"><div className="wrap">
        <h2>Your file stays private</h2><p style={{ marginTop: 10 }}>Nothing about your company appears on this website, in search or in any list.</p>
        <div className="cr-trio">
          <div><h3>Shared only on a fit</h3><p>Your credit pack goes only to lenders the desk has matched to your requirement, and you know who they are.</p></div>
          <div><h3>Lenders don&apos;t see each other</h3><p>Each lender sees its own discussion with you, not the other lenders&apos; terms.</p></div>
          <div><h3>Nothing without your OK</h3><p>No lender is approached and no document is shared until you agree to it.</p></div>
        </div>
      </div></section>

      <section className="cr-sec"><div className="wrap cr-split">
        <div><h2>Running an NBFC?</h2><p>Smaller NBFCs borrow again and again to keep lending. The desk arranges secured funding lines from larger NBFCs and institutions, on your own drawdown cycle: monthly, quarterly or yearly.</p>
          <p><a href={`${CREDIT_BASE}/nbfcs`}>Funding for NBFCs →</a></p></div>
        <div className="cr-fig"><p className="fine" style={{ margin: 0 }}>Guides for NBFCs</p><ul className="cr-mini">{[["raise-secured-debt-from-larger-nbfcs", "Raising secured debt from larger NBFCs"], ["drawdown-cycle-monthly-quarterly-yearly", "Choosing a drawdown cycle"], ["two-level-diligence", "Being ready for lender diligence"]].map(([s, t]) => <li key={s}><a href={`${CREDIT_BASE}/guides/${s}`}>{t} →</a></li>)}</ul></div>
      </div></section>

      <AccessBand side="company" title="Tell us what you need" body="Amount, purpose and the security you can offer. The desk will call you back to take it further. No documents needed at this stage." />
    </CreditShell>
  );
}
