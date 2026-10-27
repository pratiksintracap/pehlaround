import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta, faqLd, crumbsLd, ld } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { GUIDES, guideBySlug } from "@/lib/promoter-guides";

// One guide for promoters and CFOs (lib/promoter-guides.ts). Reference first; the desk appears only at the end.
type P = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return GUIDES.map((g) => ({ slug: g.slug })); }

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return pageMeta({ path: `/raise/${g.slug}`, title: g.title, description: g.desc, type: "article", publishedTime: `${g.updated}T09:00:00+05:30`, modifiedTime: `${g.updated}T09:00:00+05:30`, authors: ["Before the Bell team"] });
}

const fmt = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export default async function GuidePage({ params }: P) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const path = `/raise/${g.slug}`;
  const faqHtml = `<div class="faq">${g.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>`;
  const faq = faqLd(faqHtml);
  const article = { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.desc, inLanguage: "en-IN",
    datePublished: g.updated, dateModified: g.updated, image: [`${SITE_URL}/og.jpg`], mainEntityOfPage: SITE_URL + path,
    author: { "@type": "Organization", name: "Before the Bell", url: SITE_URL }, publisher: { "@id": `${SITE_URL}/#org` } };
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <p className="crumb"><a href="/raise">← Guides for promoters</a></p>
      <article className="art">
        <span className="eyebrow">For promoters · Updated {fmt(g.updated)}</span>
        <h1>{g.title}</h1>
        <p className="lede">{g.lede}</p>
        <div className="art-body" dangerouslySetInnerHTML={{ __html: g.body }} />
        <h2 style={{ marginTop: 36 }}>Questions promoters ask</h2>
        <div dangerouslySetInnerHTML={{ __html: faqHtml }} />
        <div className="chart raise-cta" style={{ marginTop: 32 }}>
          <span className="k">Raising before your IPO?</span>
          <p>Before the Bell takes pre-IPO rounds and secondaries in profitable Indian companies to family offices, funds and qualified investors. The desk approves the company on its own diligence and invests its own capital before the round opens. Tell the desk about your company in a minute, or take the free IPO readiness check first.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn primary" href="/founders">Tell the desk about your company</a><a className="btn ghost" href="/founders#check">Take the readiness check</a></div>
        </div>
        <h2 style={{ marginTop: 32, fontSize: 20 }}>More for promoters</h2>
        <ul className="raise-more">{others.map((o) => <li key={o.slug}><a href={`/raise/${o.slug}`}>{o.title}</a></li>)}</ul>
        <p className="fine" style={{ marginTop: 18 }}>For information only, not legal, tax or investment advice. Regulations change; your merchant banker, company secretary and lawyer will confirm what applies to your company.</p>
      </article>
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={ld(faq)} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(article)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd([["Home", "/"], ["Guides for promoters", "/raise"], [g.title, path]]))} />
    </div></main>
  );
}
