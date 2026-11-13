import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell } from "@/components/credit/CreditBits";
import { FullFlow, SellDownDiagram } from "@/components/credit/diagrams";

const D = "How the debt desk arranges a loan for a company: your requirement, the credit pack, matching to the right lenders, competing term sheets, then sanction, documentation and disbursement.";
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/how-it-works`, title: "How the debt desk works", description: D });

export default function HowItWorks() {
  return (
    <CreditShell here="/how-it-works">
      <section className="cr-hero"><div className="wrap">
        <p className="cr-kick">How it works</p>
        <h1>From the first call to the first drawdown.</h1>
        <p className="cr-lede">The desk does the work a company&apos;s finance team would otherwise do lender by lender: packaging the credit, finding the lenders that fit, and running the process to a sanction.</p>
      </div></section>
      <section className="cr-sec"><div className="wrap cr-split">
        <div><h2>The steps</h2><ol className="cr-points">
          <li><b>Your requirement.</b> A call with the desk: how much, what for, over what tenor, and the security you can offer.</li>
          <li><b>Credit pack.</b> The desk reviews your financials, banking and security and prepares the information memorandum and data lenders ask for. It tells you plainly what lenders will question.</li>
          <li><b>Structure.</b> Senior term debt, working capital, NCD, CP or a structured facility: the desk recommends the shape that fits your cash flows and existing lenders.</li>
          <li><b>Lender match.</b> The pack goes only to the banks, NBFCs and credit funds that lend in your sector, size and security, with your agreement on each.</li>
          <li><b>Term sheets.</b> Each lender runs its own credit review. You compare rate, tenor, security and covenants side by side, and the desk negotiates.</li>
          <li><b>Sanction and disbursement.</b> The desk stays with you through the sanction letter, documentation, security creation and the first drawdown.</li></ol></div>
        <figure className="cr-fig"><FullFlow /></figure>
      </div></section>
      <section className="cr-sec alt"><div className="wrap cr-split rev">
        <div><h2>Larger facilities, split across lenders</h2><p>When one lender can&apos;t or shouldn&apos;t take the whole amount, the desk splits the facility across several on the same security and terms, so no lender gets a better deal than another and you deal with one set of documents.</p></div>
        <figure className="cr-fig"><SellDownDiagram /></figure>
      </div></section>
      <section className="cr-sec"><div className="wrap cr-trio light">
        <div><h3>What to have ready</h3><p>Three years of audited financials, the latest year&apos;s provisional numbers, existing loan details and what you can offer as security. The desk asks for anything else once it understands the requirement.</p></div>
        <div><h3>Who it&apos;s for</h3><p>Profitable, growing companies, listed or unlisted, their promoters and holding companies, and NBFCs that need funding lines.</p></div>
        <div><h3>Confidential throughout</h3><p>Your file goes only to lenders you agree to. Nothing about your company appears on this website.</p></div>
      </div></section>
      <AccessBand side="company" title="Tell us what you need" body="Amount, purpose and the security you can offer. The desk will call you back to take it further." />
    </CreditShell>
  );
}
