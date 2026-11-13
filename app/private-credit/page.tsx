import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell, GuideList, applyHref } from "@/components/credit/CreditBits";
import { HeroNetwork } from "@/components/credit/diagrams";
import { GlyphCycles, GlyphDiligence, GlyphMatch, GlyphSellDown } from "@/components/credit/glyphs";

// The debt desk's front page: secured NBFC-to-NBFC lending and larger loans for companies. Nothing about any borrower,
// lender, raise, rate or amount is public; all of that sits behind sign-in in the credit console.
const D = "Secured NBFC-to-NBFC lending and larger loans for companies, matched and diligenced online. Smaller NBFCs raise on their own cycle; lenders see only the raises that fit their book.";
export const metadata: Metadata = pageMeta({ path: CREDIT_BASE, title: "Private credit: secured NBFC-to-NBFC lending", description: D });

export default function PrivateCredit() {
  return (
    <CreditShell here="">
      <section className="cr-hero"><div className="wrap cr-hero-in">
        <div>
          <p className="cr-kick">Private credit · the debt desk</p>
          <h1>Secured NBFC-to-NBFC lending, <em>matched and diligenced online.</em></h1>
          <p className="cr-lede">Smaller NBFCs raise secured funding on their own cycle. Larger NBFCs and institutions see only the raises that fit their book. The desk runs the diligence, the matching and the sell-down in between.</p>
          <div className="cr-ctas"><a className="btn primary" href={`${CREDIT_BASE}/borrowers`}>I&apos;m borrowing</a><a className="btn ghost" href={`${CREDIT_BASE}/lenders`}>I&apos;m lending</a></div>
        </div>
        <figure className="cr-fig" style={{ margin: 0 }}><HeroNetwork /></figure>
      </div></section>

      <section className="cr-sec"><div className="wrap">
        <div className="cr-head"><h2>What the desk does</h2><p>Without a platform, a raise is placed one lender at a time. The debt desk puts both sides, and the diligence between them, in one place.</p></div>
        <ul className="cr-caps" data-reveal>
          <li><GlyphDiligence /><div><h3>Two-level diligence, online</h3><p>The desk screens the borrower before a raise is shared. Each lender then runs its own diligence on the same files.</p><a className="more" href={`${CREDIT_BASE}/how-it-works#two-level-diligence`}>How diligence works →</a></div></li>
          <li><GlyphMatch /><div><h3>Matching on thesis, rate band and risk appetite</h3><p>A raise goes only to the lenders it fits, for example a lender looking for vehicle-loan exposure.</p><a className="more" href={`${CREDIT_BASE}/how-it-works#matching`}>How matching works →</a></div></li>
          <li><GlyphSellDown /><div><h3>Sell-down across lenders at parity</h3><p>One raise can be split across several lenders, each on the same security, terms and rate.</p><a className="more" href={`${CREDIT_BASE}/how-it-works#sell-down`}>How sell-down works →</a></div></li>
          <li><GlyphCycles /><div><h3>Recurring drawdowns on each borrower&apos;s cycle</h3><p>Monthly, quarterly or yearly. Each drawdown builds on the file already on the desk.</p><a className="more" href={`${CREDIT_BASE}/how-it-works#drawdowns`}>How drawdowns recur →</a></div></li>
        </ul>
      </div></section>

      <section className="cr-sec alt"><div className="wrap">
        <div className="cr-head"><h2>Three ways in</h2></div>
        <div className="cr-sides2">
          <article className="cr-side"><h3>Borrowing NBFCs</h3><p className="who">You need secured funding to keep lending.</p>
            <ul><li><b>Funding on your own cycle</b><span>Draw down monthly, quarterly or yearly.</span></li><li><b>Several lenders from one proposal</b><span>Your raise can be sold down across lenders.</span></li><li><b>Diligence uploaded once</b><span>Held online and kept current, not rebuilt for each lender.</span></li></ul>
            <a className="btn primary" href={applyHref}>Apply for funding</a></article>
          <article className="cr-side"><h3>Lending NBFCs and institutions</h3><p className="who">You want secured exposure that fits your book.</p>
            <ul><li><b>Deal flow filtered to your thesis</b><span>You see raises matched to the segments you target.</span></li><li><b>Rate and risk fit</b><span>Matched to your rate band and risk appetite.</span></li><li><b>Company diligence online</b><span>Screened before it reaches you, ready for your own review.</span></li></ul>
            <a className="btn" href={`${CREDIT_BASE}/lenders`}>For lenders</a></article>
          <article className="cr-side"><h3>Companies raising larger loans</h3><p className="who">Term loans, working capital, NCDs, commercial paper, acquisition finance.</p>
            <ul><li><b>One proposal, the right lenders</b><span>The desk takes your requirement to the banks, NBFCs and funds that lend in your space.</span></li><li><b>Structured to the cash flows</b><span>Tenor, security and repayment shaped around the business.</span></li><li><b>Kept confidential</b><span>Nothing about your company is shown publicly.</span></li></ul>
            <a className="btn" href={`${CREDIT_BASE}/request-access?as=company`}>Tell the desk</a></article>
        </div>
      </div></section>

      <section className="cr-sec"><div className="wrap">
        <div className="cr-head"><h2>How a raise moves</h2><p>Online from proposal to funding.</p></div>
        <ol className="cr-steps" data-reveal>
          <li><h3>Funding proposal</h3><p>The borrower brings the amount it needs and the security behind it.</p></li>
          <li><h3>Level 1 diligence</h3><p>The desk collects and reviews the company diligence online.</p></li>
          <li><h3>Matching</h3><p>The raise is matched on thesis, rate band and risk appetite.</p></li>
          <li><h3>Level 2 diligence</h3><p>Each matched lender runs its own diligence on the same files.</p></li>
          <li><h3>Sell-down and funding</h3><p>The raise is sold down at parity, sanctioned and funded.</p></li>
        </ol>
        <p className="fine" style={{ marginTop: 16 }}>The borrower&apos;s next drawdown starts from the same file. <a href={`${CREDIT_BASE}/how-it-works`}>See the full flow →</a></p>
      </div></section>

      <section className="cr-sec cr-dark"><div className="wrap">
        <h2>Nothing about a deal is public</h2><p style={{ marginTop: 10 }}>Everything specific to a borrower, a lender or a raise sits behind sign-in.</p>
        <div className="cr-trio">
          <div><h3>Borrowers</h3><p>Diligence and terms are shared only with the lenders matched to the raise.</p></div>
          <div><h3>Lenders</h3><p>Each lender sees its own position. Other lenders&apos; names, terms and activity stay hidden.</p></div>
          <div><h3>Access</h3><p>Accounts are by invitation, and every sign-in needs a one-time code sent to your work email.</p></div>
        </div>
        <p style={{ marginTop: 24 }}><a href={`${CREDIT_BASE}/confidentiality`}>See who sees what →</a></p>
      </div></section>

      <section className="cr-sec"><div className="wrap"><div className="cr-head"><h2>Guides for borrowing NBFCs</h2></div><GuideList /></div></section>

      <AccessBand title="Request access" body="Tell us whether you're borrowing, lending or raising a larger loan. The desk will get in touch to set up your account." />
    </CreditShell>
  );
}
