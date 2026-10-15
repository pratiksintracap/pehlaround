/** Press coverage of Before the Bell. Add an entry when a piece runs; the home-page strip and /press show
 *  nothing until there is at least one. Never list a piece that has not been published. */
export type Coverage = { outlet: string; title: string; url: string; date: string; kind?: "article" | "mention" | "podcast" | "tv" };
export const COVERAGE: Coverage[] = [];

export const PRESS_CONTACT = { name: "Pratik Saraogi", role: "Founder, Before the Bell · Managing Partner, SintraCap Advisors LLP", email: "desk@beforethebell.in" };

export const BOILERPLATE = {
  short: "Before the Bell is a pre-IPO deal desk for family offices: profitable, IPO-bound private companies, checked before an office sees them, with one structured deal room for every company. It is operated by SintraCap Advisors LLP, Mumbai.",
  long: "Before the Bell (beforethebell.in) is a pre-IPO deal desk for Indian family offices. Companies on the desk are profitable, private and on a path to a main-board listing, and each is checked by SintraCap Advisors before any office sees it: the numbers, the round and valuation, the path to listing, the risks the desk sees, and the promoter's answers. Registered and approved offices sign a company's NDA on screen, read the same structured deal room for every company, put questions to the promoter, join promoter sessions and request allocations. Money moves directly between the office and the company or seller, never through the desk. A new company goes up about every fortnight. Before the Bell is operated by SintraCap Advisors LLP, a Mumbai investment banking and advisory firm that has concluded 25+ transactions in the last two years across pre-IPO rounds, public offers, preferential allotments, blocks, structured credit and warehousing, and commits its own capital alongside the offices it invites.",
};

/** Facts a journalist can use without a call. Keep these true to the site; figures come from /about. */
export const FACTS: [string, string][] = [
  ["What it is", "A pre-IPO deal desk for family offices, by approval. Not a trading platform: shares are never bought or sold on the site, and no unlisted shares are listed for sale."],
  ["Who it is for", "Family offices and the principals, CIOs, CFOs and CAs who work for them. Funds, AIFs and institutions are routed to SintraCap."],
  ["How a deal reaches an office", "Each company's round is a private placement under the Companies Act, shown only to registered and approved offices after they sign that company's NDA on screen."],
  ["What the desk checks", "Audited numbers, the round and valuation against listed peers, the path to listing, the promoter's answers, and the risks the desk sees, set out the same way for every company."],
  ["Cadence", "About one new company a fortnight; articles from the desk about once a week."],
  ["Operator", "SintraCap Advisors LLP, Lower Parel, Mumbai (LLPIN ACL-6334): 25+ transactions in the last two years, upwards of ₹2,000 Cr; 40+ years in Indian capital markets across the team."],
  ["Launched", "October 2026, as the successor to the desk SintraCap ran for its own network."],
];
