import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell } from "@/components/credit/CreditBits";
import { CyclesDiagram, FullFlow, MatchFunnel, SellDownDiagram, TwoLevelDiagram } from "@/components/credit/diagrams";

const D = "How a raise moves on the debt desk: funding proposal, Level 1 diligence, matching on thesis, rate band and risk appetite, each lender's Level 2 diligence, sell-down at parity, and recurring drawdowns on the borrower's cycle.";
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/how-it-works`, title: "How the debt desk works", description: D });

export default function HowItWorks() {
  return (
    <CreditShell here="/how-it-works">
      <section className="cr-hero"><div className="wrap">
        <p className="cr-kick">How it works</p>
        <h1>From funding proposal to sell-down, in one place.</h1>
        <p className="cr-lede">Every raise follows the same path. The borrower brings a proposal, the desk screens it, matches it to the lenders it fits, and sells it down across them at parity.</p>
      </div></section>
      <section className="cr-sec"><div className="wrap cr-split">
        <div><h2>The full flow</h2><ol className="cr-points">
          <li><b>Funding proposal.</b> The borrowing NBFC brings the amount it needs and the security behind it.</li>
          <li><b>Level 1 diligence.</b> The desk collects and reviews the company diligence online.</li>
          <li><b>Matching.</b> The raise is matched to lenders on thesis, rate band and risk appetite, and shared only with them.</li>
          <li><b>Level 2 diligence.</b> Each matched lender runs its own diligence on the same files.</li>
          <li><b>Sell-down at parity.</b> The raise is split across the lenders who take part, on the same security, terms and rate.</li>
          <li><b>Sanction and funding.</b> Each lender&apos;s part is sanctioned and funded.</li></ol></div>
        <figure className="cr-fig"><FullFlow /></figure>
      </div></section>
      <section className="cr-sec alt" id="two-level-diligence"><div className="wrap cr-split rev">
        <div><h2>Two-level diligence</h2><p>Level 1 is the desk&apos;s screening. The team collects the borrower&apos;s company diligence online and reviews it before any raise is shared. It is baselined once, then refreshed quarterly or when something material changes.</p><p>Level 2 is each lender&apos;s own diligence on the borrower. Lenders work from the same files and record their review alongside them.</p></div>
        <figure className="cr-fig"><TwoLevelDiagram /></figure>
      </div></section>
      <section className="cr-sec" id="matching"><div className="wrap cr-split">
        <div><h2>Matching</h2><p>Each lender&apos;s profile holds its thesis (the segments it wants exposure to, such as vehicle loans), its rate band and its risk appetite. A raise is shared with a lender only when it fits all three.</p><p>Lenders it doesn&apos;t fit never see it.</p></div>
        <figure className="cr-fig"><MatchFunnel /></figure>
      </div></section>
      <section className="cr-sec alt" id="sell-down"><div className="wrap cr-split rev">
        <div><h2>Sell-down and parity</h2><p>A raise can be sold down across several lenders. Parity means every lender in the raise gets the same security, the same terms and the same rate.</p><p>Each lender sees the total and how much is filled, never who else is in the raise.</p></div>
        <figure className="cr-fig"><SellDownDiagram /></figure>
      </div></section>
      <section className="cr-sec" id="drawdowns"><div className="wrap cr-split">
        <div><h2>Recurring drawdowns</h2><p>Borrowing recurs, so the desk is built around repeat raises rather than one-off deals. Each borrower draws down on its own cycle: monthly, quarterly or yearly.</p><p>Every new drawdown builds on the diligence and history already on the desk.</p></div>
        <figure className="cr-fig"><CyclesDiagram /></figure>
      </div></section>
      <AccessBand title="Request access" body="Tell us whether you're borrowing, lending or raising a larger loan. The desk will get in touch to set up your account." />
    </CreditShell>
  );
}
