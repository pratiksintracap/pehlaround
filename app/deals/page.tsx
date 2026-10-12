import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { listDeals, signedDealIds, canSeeNames } from "@/lib/deals";
import { shelfHtml } from "@/lib/render";

const D = "Pre-IPO and growth rounds on the desk, shown without company names. Register to see the company, valuation and data room.";
export const metadata: Metadata = { title: "Deals", description: D, openGraph: { title: "Deals · Pehla Round", description: D } };

export default async function DealsPage() {
  const [user, deals] = await Promise.all([getUser(), listDeals()]);
  const signed = await signedDealIds(user?.officeId);
  return (
    <main>
      <div className="wrap phead">
        <span className="eyebrow">Deals</span>
        <h1>Deals on the desk</h1>
        <p>Every deal in one fixed format, without company names. Names, round size, valuation, trailing and forward P/E and the data room open to registered family offices once that company&apos;s NDA is signed.</p>
      </div>
      <section className="sec tight"><div className="wrap">
        <div className="shelf" dangerouslySetInnerHTML={{ __html: shelfHtml(deals, signed, await canSeeNames(user)) }} />
      </div></section>
    </main>
  );
}
