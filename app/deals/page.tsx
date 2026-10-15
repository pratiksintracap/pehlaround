import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getUser } from "@/lib/auth";
import { listDeals, signedDealIds, canSeeNames, listUpcoming } from "@/lib/deals";
import { shelfHtml, upcomingHtml } from "@/lib/render";

const D = "Pre-IPO rounds in profitable, IPO-bound Indian companies, a new one about every fortnight. Approved investors see each company by name.";
export const metadata: Metadata = pageMeta({ path: "/deals", title: "Pre-IPO deals on the desk", description: D });

export default async function DealsPage() {
  const [user, deals, upcoming] = await Promise.all([getUser(), listDeals(), listUpcoming()]);
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
      <div dangerouslySetInnerHTML={{ __html: upcomingHtml(upcoming, !!user) }} />
    </main>
  );
}
