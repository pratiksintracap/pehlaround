import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { listArticles, artDate, artHref } from "@/lib/articles";
import { Cover } from "@/components/Cover";

const D = "Notes from the desk on Indian IPOs, pre-IPO rounds, SME listings and the market, for family offices, funds and serious investors.";
export const metadata: Metadata = pageMeta({ path: "/articles", title: "Articles on IPOs and pre-IPO rounds", description: D });

const GUIDES: [string, string, string, string][] = [
  ["/pre-ipo-investing", "Guide", "Pre-IPO investing", "How rounds work, lock-ins, tax and what to check before you invest."],
  ["/ipo-calendar", "Tracker", "IPO calendar", "Every main-board and SME issue: dates, price bands, listing."],
  ["/raise", "For promoters", "Raising before an IPO", "Who invests in a pre-IPO round, at what price, and how it is run."],
  ["/sell", "For shareholders", "Selling pre-IPO shares", "How a secondary sale works and what buyers look for."],
];

export default async function Articles({ searchParams }: { searchParams: Promise<{ subscribed?: string; error?: string }> }) {
  const { subscribed, error } = await searchParams;
  const list = await listArticles();
  return (
    <main>
      <div className="wrap phead"><span className="eyebrow">Articles</span><h1>From the desk</h1>
        <p>Short reads on IPOs, private rounds and the market, written for family offices.</p></div>
      <section className="sec tight"><div className="wrap">
        <nav className="guides" aria-label="Guides">{GUIDES.map(([h, k, t, d]) => <a key={h} href={h}><span className="eyebrow">{k}</span><b>{t}</b><small>{d}</small></a>)}</nav>
        <div className="art-list">{list.map((a) => (
          <a key={a.id} className="art-card rv inview" href={artHref(a)} {...(a.externalUrl ? { target: "_blank", rel: "noopener" } : {})}>
            <Cover a={a} />
            <span className="mono">{artDate(a.publishedAt, true)}{a.externalUrl ? " · published elsewhere" : ""}</span>
            <h2>{a.title}</h2>{a.dek && <p>{a.dek}</p>}<span className="art-more">Read →</span>
          </a>))}
          {!list.length && <p>No articles yet.</p>}</div>
        <div className="subscribe rv inview" id="subscribe">
          <div><span className="eyebrow">Articles by email</span><h2 style={{ margin: "4px 0 2px", fontSize: 22 }}>About one a week, written for family offices</h2>
            <p className="fine">New pieces from the desk, every Monday morning. Unsubscribe with one click.</p></div>
          {subscribed ? <p className="ok show" role="status">You&apos;re on the list. A confirmation is on its way.</p> : <>
            {error && <p className="ok show bad" role="alert">{error}</p>}
            <form method="post" action="/api/subscribe" data-api="">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
              <input type="email" name="email" required maxLength={200} placeholder="you@familyoffice.in" aria-label="Email address" />
              <button className="btn primary" type="submit">Send me the articles</button>
            </form></>}
        </div>
      </div></section>
    </main>
  );
}
