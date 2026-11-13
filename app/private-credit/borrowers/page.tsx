import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell, applyHref } from "@/components/credit/CreditBits";
import { CyclesDiagram, DiligenceOnceDiagram, SellDownDiagram } from "@/components/credit/diagrams";

const D = "Secured funding for smaller NBFCs on their own cycle: monthly, quarterly or yearly. One proposal can be sold down across several lenders, with company diligence uploaded once and held online.";
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/borrowers`, title: "For borrowing NBFCs", description: D });

export default function Borrowers() {
  return (
    <CreditShell here="/borrowers">
      <section className="cr-hero"><div className="wrap">
        <p className="cr-kick">For borrowing NBFCs</p>
        <h1>Secured funding on your own cycle.</h1>
        <p className="cr-lede">Bring one funding proposal. The desk runs the diligence, matches your raise to the lenders it fits, and sells it down across them at parity. Your next drawdown starts from the same file.</p>
        <div className="cr-ctas"><a className="btn primary" href={applyHref}>Apply for funding</a><a className="btn ghost" href={`${CREDIT_BASE}/how-it-works`}>How it works</a></div>
      </div></section>
      <section className="cr-sec"><div className="wrap">
        <div className="cr-split"><div><h2>Draw down when your book needs it</h2><p>Your funding recurs on the cycle that fits your lending: monthly, quarterly or yearly. Each drawdown is a new raise on the desk, built on the diligence already held for your company.</p></div><figure className="cr-fig"><CyclesDiagram /></figure></div>
        <div className="cr-split rev"><div><h2>One proposal, several lenders</h2><p>Instead of placing your raise with one lender at a time, the desk can sell it down across several lenders. Every lender in the raise gets the same security, the same terms and the same rate.</p></div><figure className="cr-fig"><SellDownDiagram /></figure></div>
        <div className="cr-split"><div><h2>Diligence uploaded once</h2><p>Your company diligence is collected once and held online. It is baselined, then refreshed quarterly or when something material changes, so it isn&apos;t rebuilt for each lender or each drawdown.</p><p>Matched lenders read the same files for their own diligence.</p></div><figure className="cr-fig"><DiligenceOnceDiagram /></figure></div>
      </div></section>
      <section className="cr-sec alt"><div className="wrap cr-trio light">
        <div><h3>A faster process, online end to end</h3><p>Proposal, diligence, matching, sell-down and funding all run in one place, so each step picks up from the last instead of starting over by email.</p></div>
        <div><h3>What you&apos;ll need</h3><p>Your company diligence, and for each raise the amount and the security behind it. The desk takes you through the specifics once your account is set up.</p></div>
        <div><h3>An adviser can apply for you</h3><p>The borrower form can be filled by your NBFC or your adviser. Answers save as you go, and documents upload straight into the form.</p></div>
      </div></section>
      <AccessBand side="borrower" title="Raise on your own cycle" body="Fill the borrower form for your NBFC, or have your adviser fill it for you. No account needed: answers save as you go." cta={{ href: applyHref, label: "Apply for funding" }} />
    </CreditShell>
  );
}
