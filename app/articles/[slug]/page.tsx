import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getArticle, listArticles, artDate, artHref } from "@/lib/articles";
import { md } from "@/lib/md";
import { Cover } from "@/components/Cover";
import { coverPhoto } from "@/lib/cover-theme";
import { pageMeta, fitsWithBrand, articleLd, crumbsLd, ld } from "@/lib/seo";

type P = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a || !a.published) return {};
  const desc = a.dek || a.body.replace(/[#*_>\-]/g, "").replace(/\s+/g, " ").slice(0, 155);
  return pageMeta({ path: `/articles/${a.slug}`, title: a.title, absoluteTitle: !fitsWithBrand(a.title), description: desc, type: "article",
    image: { url: coverPhoto(a, 1200, 630), width: 1200, height: 630, alt: a.title },
    publishedTime: a.publishedAt.toISOString(), modifiedTime: a.updatedAt.toISOString(), authors: [a.author] });
}

export default async function Article({ params }: P) {
  const a = await getArticle((await params).slug);
  if (!a || !a.published || a.publishedAt > new Date()) notFound();
  if (a.externalUrl) redirect(a.externalUrl);
  const more = (await listArticles(4)).filter((x) => x.id !== a.id).slice(0, 3);
  return (
    <main><div className="wrap" style={{ paddingTop: 24, paddingBottom: 56 }}>
      <p className="crumb"><a href="/articles">← All articles</a></p>
      <article className="art">
        <span className="eyebrow">{artDate(a.publishedAt, true)} · {a.author}</span>
        <h1>{a.title}</h1>
        {a.dek && <p className="lede">{a.dek}</p>}
        <Cover a={a} className="cover-hero" hero />
        <div className="art-body" dangerouslySetInnerHTML={{ __html: md(a.body) }} />
        {a.sources.length > 0 && <div className="art-src"><span className="k">Sources</span><ul>{a.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener">{s.title}</a></li>)}</ul></div>}
        <p className="art-next">New to pre-IPO investing? Read <a href="/pre-ipo-investing">the guide</a>, or <a href="/deals">see the companies on the desk</a>.</p>
        <p className="fine">For information only. Not an offer, advice or a recommendation to buy or sell any security.</p>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(articleLd({ ...a, image: coverPhoto(a, 1200, 630) }))} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ld(crumbsLd([["Home", "/"], ["Articles", "/articles"], [a.title, `/articles/${a.slug}`]]))} />
      {more.length > 0 && <section className="sec tight"><span className="eyebrow">More from the desk</span>
        <ul className="more">{more.map((m) => <li key={m.id}><a href={artHref(m)}><span className="s">{m.title}</span><span className="f">{artDate(m.publishedAt, true)}</span></a></li>)}</ul></section>}
    </div></main>
  );
}
