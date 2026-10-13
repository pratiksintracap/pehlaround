import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getArticle, listArticles, artDate, artHref } from "@/lib/articles";
import { md } from "@/lib/md";
import { Cover } from "@/components/Cover";

type P = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: P): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a || !a.published) return {};
  return { title: a.title, description: a.dek || undefined, openGraph: { type: "article", title: a.title, description: a.dek || undefined } };
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
        <p className="fine">For information only. Not an offer, advice or a recommendation to buy or sell any security.</p>
      </article>
      {more.length > 0 && <section className="sec tight"><span className="eyebrow">More from the desk</span>
        <ul className="more">{more.map((m) => <li key={m.id}><a href={artHref(m)}><span className="s">{m.title}</span><span className="f">{artDate(m.publishedAt, true)}</span></a></li>)}</ul></section>}
    </div></main>
  );
}
