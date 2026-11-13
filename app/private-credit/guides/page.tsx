import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { AccessBand, CreditShell, GuideList } from "@/components/credit/CreditBits";

export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/guides`, title: "Guides for borrowing NBFCs", description: "How NBFC-to-NBFC lending works: secured raises, drawdown cycles, two-level diligence and how lenders match a raise." });

export default function Guides() {
  return (
    <CreditShell here="/guides">
      <section className="cr-hero slim"><div className="wrap"><p className="cr-kick">Guides</p><h1>Guides for borrowing NBFCs</h1>
        <p className="cr-lede">Plain explanations of how secured NBFC-to-NBFC lending works, and how to be ready for it.</p></div></section>
      <section className="cr-sec"><div className="wrap"><GuideList /></div></section>
      <AccessBand side="nbfc" title="Raise on your own cycle" body="Tell us about your NBFC. The desk will get in touch to set up a secure account." />
    </CreditShell>
  );
}
