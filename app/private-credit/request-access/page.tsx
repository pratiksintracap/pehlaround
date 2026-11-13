import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { CREDIT_BASE } from "@/lib/credit";
import { CreditShell, applyHref } from "@/components/credit/CreditBits";
import { RequestAccess } from "@/components/credit/RequestAccess";

export const metadata: Metadata = pageMeta({ path: `${CREDIT_BASE}/request-access`, title: "Request access to the debt desk", description: "Request an account on the debt desk as a borrowing NBFC, a lending NBFC or institution, or a company raising a larger loan." });

export default function Request() {
  return (
    <CreditShell here="">
      <section className="cr-hero slim"><div className="wrap">
        <p className="cr-kick">Request access</p>
        <h1>Tell the desk who you are.</h1>
        <p className="cr-lede">The desk will get in touch by email to set up a secure account. Borrowing NBFCs can also <a href={applyHref}>fill the borrower form directly</a>, without an account.</p>
      </div></section>
      <section className="cr-sec"><div className="wrap"><RequestAccess /></div></section>
    </CreditShell>
  );
}
