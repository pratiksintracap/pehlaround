import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell } from "@/components/credit/CreditBits";
import { MatchFunnel, RiskSpectrum, SellDownDiagram, TwoLevelDiagram } from "@/components/credit/diagrams";

const D = "Deal flow for larger NBFCs and institutions, filtered to your thesis, rate band and risk appetite. Company diligence is screened and online, every lender in a raise is on parity, and you see only your own position.";
export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/lenders`, title: "For lending NBFCs and institutions", description: D });

export default function Lenders() {
  return (
    <CreditShell here="/lenders">
      <section className="cr-hero"><div className="wrap">
        <p className="cr-kick">For lending NBFCs and institutions</p>
        <h1>Deal flow filtered to your book.</h1>
        <p className="cr-lede">Tell the desk what you lend against. You see only the secured raises that match your thesis, your rate band and your risk appetite, with the company diligence already online.</p>
        <div className="cr-ctas"><a className="btn primary" href={`${CREDIT_BASE}/request-access?as=lender`}>Request access</a><a className="btn ghost" href={`${CREDIT_BASE}/confidentiality`}>Who sees what</a></div>
      </div></section>
      <section className="cr-sec"><div className="wrap">
        <div className="cr-split"><div><h2>Matched to your thesis</h2><p>Your profile records the segments you want exposure to, for example vehicle loans. A raise is shared with you only when it passes your thesis, your rate band and your risk appetite.</p></div><figure className="cr-fig"><MatchFunnel /></figure></div>
        <div className="cr-split rev"><div><h2>Rate and risk that fit</h2><p>Raises on the desk range from more secure paper to higher-yield paper. You set where you sit, and the deal flow follows it.</p></div><figure className="cr-fig"><RiskSpectrum /></figure></div>
        <div className="cr-split"><div><h2>Company diligence, online and screened</h2><p>The desk&apos;s Level 1 screening is done before a raise reaches you. Your Level 2 diligence runs on the same files, and you record it alongside them.</p></div><figure className="cr-fig"><TwoLevelDiagram /></figure></div>
      </div></section>
      <section className="cr-sec alt"><div className="wrap">
        <div className="cr-split rev"><div><h2>Parity, and only your own position</h2><p>Every lender in a raise gets the same security, the same terms and the same rate. You can see the total and how much is filled, but not who the other lenders are or what they hold.</p><p><a href={`${CREDIT_BASE}/confidentiality`}>See the full access matrix →</a></p></div><figure className="cr-fig"><SellDownDiagram /></figure></div>
      </div></section>
      <AccessBand side="lender" title="See deal flow that fits your book" body="Tell us about your institution. The desk will get in touch to set up your lender profile and a secure account." />
    </CreditShell>
  );
}
