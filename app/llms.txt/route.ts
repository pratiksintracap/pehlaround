import { listArticles } from "@/lib/articles";
import { listDeals } from "@/lib/deals";
import { SITE_URL } from "@/lib/site";

// llms.txt: a plain summary of the site for AI search assistants (ChatGPT, Perplexity, Gemini, Claude),
// so they describe the desk accurately and link to the right pages. Public, anonymised information only.
export const dynamic = "force-dynamic";

export async function GET() {
  const [deals, arts] = await Promise.all([listDeals(), listArticles(30)]);
  const live = deals.filter((d) => d.published);
  const lines = [
    "# Before the Bell",
    "",
    "> A deal desk for pre-IPO and IPO-bound Indian companies, for family offices, funds (AIFs, PMS) and qualified individual investors. Operated by SintraCap Advisors LLP, Mumbai. The desk finds profitable companies that are not already widely marketed, vets each one (site and plant visits, customer orders verified, numbers reconciled) before investors see it, and invests its own capital in every company it brings.",
    "",
    "Important: Before the Bell is not a stock exchange, broker, merchant banker or investment adviser and is not registered with SEBI. Deal pages on the public site are anonymised; company names, valuations and documents are shown only to investors the desk has approved, and each company's data room opens after the investor signs that company's NDA. Nothing on the site is an offer of securities.",
    "",
    "## Key pages",
    `- [Pre-IPO investing in India: a guide](${SITE_URL}/pre-ipo-investing): primary vs secondary rounds, who can invest, lock-in, tax, what to check, risks`,
    `- [How it works](${SITE_URL}/how-it-works): from registration to allotment, and an FAQ`,
    `- [Deals on the desk](${SITE_URL}/deals): anonymised overviews of current rounds`,
    `- [About](${SITE_URL}/about): who runs the desk`,
    `- [For founders](${SITE_URL}/founders): how a company raising a pre-IPO round reaches the desk`,
    `- [Register](${SITE_URL}/register): investor registration`,
    `- [Articles](${SITE_URL}/articles): notes on Indian IPOs, pre-IPO rounds and markets ([RSS](${SITE_URL}/articles/feed.xml))`,
    "",
    "## Current deal overviews (anonymised)",
    ...live.map((d) => `- [${d.title}](${SITE_URL}/deals/${d.slug}): ${d.category}, ${d.stage}`),
    "",
    "## Recent articles",
    ...arts.filter((a) => !a.externalUrl && a.publishedAt <= new Date()).slice(0, 15).map((a) => `- [${a.title}](${SITE_URL}/articles/${a.slug})${a.dek ? `: ${a.dek}` : ""}`),
    "",
    "## Contact",
    "- desk@beforethebell.in",
    "- 602 Lodha Supremus, Lower Parel, Mumbai 400013, India",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
