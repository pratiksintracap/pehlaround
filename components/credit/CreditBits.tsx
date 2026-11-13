// Shared pieces of the debt desk pages: the section's sub-navigation, the call-to-action band and the guide layout.
import { CREDIT_APP, CREDIT_BASE, CREDIT_GUIDES, creditGuide } from "@/lib/credit";
import { ld } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { CreditReveal } from "@/components/credit/CreditReveal";

const NAV: [string, string][] = [["", "Overview"], ["/how-it-works", "How it works"], ["/nbfcs", "For NBFCs"], ["/guides", "Guides"]];

export function CreditNav({ here }: { here: string }) {
  return (
    <nav className="cr-subnav" aria-label="Debt desk">
      <div className="wrap"><span className="eyebrow">Debt desk</span>
        <ul>{NAV.map(([p, l]) => <li key={p}><a href={`${CREDIT_BASE}${p}`} aria-current={here === p ? "page" : undefined}>{l}</a></li>)}</ul>
        <a className="btn sm primary" href={`${CREDIT_BASE}/request-access`}>Tell us what you need</a></div>
    </nav>
  );
}

export function CreditShell({ here, children }: { here: string; children: React.ReactNode }) {
  return <main className="cr"><CreditNav here={here} />{children}<CreditReveal /></main>;
}

export function AccessBand({ side, title, body, cta }: { side?: "company" | "nbfc"; title: string; body: string; cta?: { href: string; label: string } }) {
  const href = cta?.href ?? `${CREDIT_BASE}/request-access${side ? `?as=${side}` : ""}`;
  return (
    <section className="cr-band"><div className="wrap cr-band-in">
      <div><h2>{title}</h2><p>{body}</p></div>
      <a className="btn primary" href={href}>{cta?.label ?? "Tell us what you need"}</a>
    </div></section>
  );
}

export const applyHref = `${CREDIT_APP}/apply`;

export function GuideList({ slugs }: { slugs?: string[] }) {
  const list = slugs ? CREDIT_GUIDES.filter((g) => slugs.includes(g.slug)) : CREDIT_GUIDES;
  return <ul className="cr-guides">{list.map((g) => <li key={g.slug}><a href={`${CREDIT_BASE}/guides/${g.slug}`}><b>{g.title}</b><span>{g.summary}</span></a></li>)}</ul>;
}

export function GuideArticle({ slug, lede, children }: { slug: string; lede: React.ReactNode; children: React.ReactNode }) {
  const g = creditGuide(slug);
  const url = `${SITE_URL}${CREDIT_BASE}/guides/${slug}`;
  const data = { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, url, mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "en-IN", publisher: { "@type": "Organization", name: "Before the Bell", url: SITE_URL } };
  return (
    <CreditShell here="/guides">
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(data)} />
      <article>
        <header className="cr-hero slim"><div className="wrap"><p className="cr-kick"><a href={`${CREDIT_BASE}/guides`}>Guides</a></p><h1>{g.title}</h1><p className="cr-lede">{lede}</p></div></header>
        <div className="wrap cr-article">{children}</div>
      </article>
      <section className="cr-sec alt"><div className="wrap"><h2>More guides</h2><GuideList slugs={CREDIT_GUIDES.filter((x) => x.slug !== slug).map((x) => x.slug)} /></div></section>
      <AccessBand side="nbfc" title="Raise on your own cycle" body="Tell the desk about your NBFC. It will get in touch to take your requirement further. Please don't send financials in the first message." />
    </CreditShell>
  );
}
