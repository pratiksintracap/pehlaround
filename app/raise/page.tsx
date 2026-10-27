import type { Metadata } from "next";
import { pageMeta, crumbsLd, ld } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { GUIDES } from "@/lib/promoter-guides";

const TITLE = "Raising capital before an IPO: guides for promoters";
const DESC = "Guides for Indian promoters and CFOs: raising a pre-IPO round, SME IPO or main board, how investors value a company before listing, getting IPO-ready, and primary versus secondary.";
export const metadata: Metadata = pageMeta({ path: "/raise", title: TITLE, description: DESC });

export default function RaiseHub() {
  const list = { "@context": "https://schema.org", "@type": "ItemList", name: TITLE, itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/raise/${g.slug}`, name: g.title })) };
  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <section className="sec tight">
        <span className="eyebrow">For promoters and CFOs</span>
        <h1>Raising capital before your IPO</h1>
        <p className="note">What to know before you raise a pre-IPO round: timing, who invests, how the price is set, which board to list on, and what to fix before you file.</p>
      </section>
      <div className="raise-grid">{GUIDES.map((g) => (
        <a key={g.slug} className="chart raise-card" href={`/raise/${g.slug}`}><span className="k">{g.short}</span><b>{g.title}</b><p>{g.lede}</p><span className="raise-go">Read the guide →</span></a>))}</div>
      <div className="chart raise-cta" style={{ marginTop: 28 }}>
        <span className="k">Raising now?</span>
        <p>Tell the desk about your company in a minute, or take the free IPO readiness check. Nothing is shared with any investor until you agree what goes in the room.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn primary" href="/founders">Tell the desk about your company</a><a className="btn ghost" href="/ipo-calendar">See this week&apos;s IPOs</a></div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(list)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd([["Home", "/"], ["Guides for promoters", "/raise"]]))} />
    </div></main>
  );
}
