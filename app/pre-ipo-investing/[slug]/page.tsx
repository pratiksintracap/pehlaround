import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta, faqLd, crumbsLd, ld } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { INVESTOR_GUIDES, investorGuideBySlug } from "@/lib/investor-guides";

// One guide for investors (lib/investor-guides.ts). Reference first; the desk appears only at the end.
type P = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return INVESTOR_GUIDES.map((g) => ({ slug: g.slug })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const g = investorGuideBySlug((await params).slug);
  if (!g) return {};
  return pageMeta({ path: `/pre-ipo-investing/${g.slug}`, title: g.title, description: g.desc, type: "article", publishedTime: `${g.updated}T09:00:00+05:30`, modifiedTime: `${g.updated}T09:00:00+05:30`, authors: ["Before the Bell team"] });
}

const fmt = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export default async function InvestorGuide({ params }: P) {
  const g = investorGuideBySlug((await params).slug);
  if (!g) notFound();
  const path = `/pre-ipo-investing/${g.slug}`;
  const faqHtml = `<div class="faq">${g.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
  const faq = faqLd(faqHtml);
  const article = { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.desc, inLanguage: "en-IN",
    datePublished: g.updated, dateModified: g.updated, image: [`${SITE_URL}/og.jpg`], mainEntityOfPage: SITE_URL + path,
    author: { "@type": "Organization", name: "Before the Bell", url: SITE_URL }, publisher: { "@id": `${SITE_URL}/#org` } };
  const others = INVESTOR_GUIDES.filter((x) => x.slug !== g.slug);
  const selling = g.slug === "sell-pre-ipo-shares";
  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <p className="crumb"><a href="/pre-ipo-investing">← Pre-IPO investing guides</a></p>
      <article className="art">
        <span className="eyebrow">For investors · Updated {fmt(g.updated)}</span>
        <h1>{g.title}</h1>
        <p className="lede">{g.lede}</p>
        <div className="art-body" dangerouslySetInnerHTML={{ __html: g.body }} />
        <h2 style={{ marginTop: 36 }}>Questions investors ask</h2>
        <div dangerouslySetInnerHTML={{ __html: faqHtml }} />
        <div className="chart raise-cta" style={{ marginTop: 32 }}>
          {selling ? <>
            <span className="k">Holding pre-IPO shares you want to sell?</span>
            <p>Before the Bell works with family offices and funds that buy pre-IPO secondaries. Tell the desk what you hold and it will come back with whether it can find a buyer. Nothing is shared with anyone without your consent.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn primary" href="/sell">Tell the desk what you hold</a></div>
          </> : <>
            <span className="k">Looking at pre-IPO companies?</span>
            <p>Before the Bell brings profitable, IPO-bound Indian companies to family offices and qualified investors. The desk vets each company and puts its own capital in before the round opens. Approved investors see each company by name, sign its NDA on screen and open a data room with the numbers, the terms and the path to listing.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn primary" href="/register">Register to see the companies</a><a className="btn ghost" href="/deals">The deals on the desk</a></div>
          </>}
        </div>
        <h2 style={{ marginTop: 32, fontSize: 20 }}>More for investors</h2>
        <ul className="raise-more"><li><a href="/pre-ipo-investing">Pre-IPO investing in India: a guide for investors</a></li>{others.map((o) => <li key={o.slug}><a href={`/pre-ipo-investing/${o.slug}`}>{o.title}</a></li>)}</ul>
        <p className="fine" style={{ marginTop: 18 }}>For information only. Not an offer, legal, tax or investment advice, or a recommendation to buy or sell any security. Regulations and tax rates change; take advice on your own position.</p>
      </article>
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(article)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd([["Home", "/"], ["Pre-IPO investing in India", "/pre-ipo-investing"], [g.title, path]]))} />
    </div></main>
  );
}
