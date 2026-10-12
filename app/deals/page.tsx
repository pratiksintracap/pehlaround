import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { listDeals, signedDealIds, canSeeNames } from "@/lib/deals";
import { shelfHtml } from "@/lib/render";

const D = "Pre-IPO and growth rounds on the desk, with a new one about every fortnight, shown without company names. Registered offices see the company and valuation once the desk approves them.";
export const metadata: Metadata = { title: "Deals", description: D, openGraph: { title: "Deals · Pehla Round", description: D } };

export default async function DealsPage() {
  const [user, deals] = await Promise.all([getUser(), listDeals()]);
  const signed = await signedDealIds(user?.officeId);
  return (
    <main>
      <div className="wrap phead">
        <span className="eyebrow">Deals</span>
        <h1>Deals on the desk</h1>
        <p>Every deal in one fixed format, without company names, and a new one about every fortnight. Names, round size, valuation and trailing and forward P/E open once the desk approves your office; each data room opens with that company&apos;s NDA.</p>
      </div>
      <section className="sec tight"><div className="wrap">
        <div className="shelf" dangerouslySetInnerHTML={{ __html: shelfHtml(deals, signed, await canSeeNames(user)) }} />
      </div></section>
    </main>
  );
}
