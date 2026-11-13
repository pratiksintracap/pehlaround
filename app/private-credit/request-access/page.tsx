import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { CreditShell, applyHref } from "@/components/credit/CreditBits";
import { RequestAccess } from "@/components/credit/RequestAccess";

export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/request-access`, title: "Tell the debt desk what you need", description: "Tell the debt desk how much your company or NBFC needs to borrow, and what for. The desk calls you back." });

export default function Request() {
  return (
    <CreditShell here="/request-access">
      <section className="cr-hero slim"><div className="wrap">
        <p className="cr-kick">Debt desk</p>
        <h1>Tell us what you need.</h1>
        <p className="cr-lede">A few lines on the requirement is enough. The desk calls you back to understand it and tells you what lenders will ask for. NBFCs can also <a href={applyHref}>fill the full borrower form</a> straight away.</p>
      </div></section>
      <section className="cr-sec"><div className="wrap"><RequestAccess /></div></section>
    </CreditShell>
  );
}
