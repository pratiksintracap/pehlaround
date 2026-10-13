import type { Metadata } from "next";
import { listArticles, artDate, artHref } from "@/lib/articles";
import { Cover } from "@/components/Cover";

const D = "Notes from the desk on IPOs, private rounds and the market, for family offices.";
export const metadata: Metadata = { title: "Articles", description: D, openGraph: { title: "Articles · Off Market Desk", description: D } };

export default async function Articles() {
  const list = await listArticles();
  return (
    <main>
      <div className="wrap phead"><span className="eyebrow">Articles</span><h1>From the desk</h1>
        <p>Short reads on IPOs, private rounds and the market, written for family offices.</p></div>
      <section className="sec tight"><div className="wrap">
        <div className="art-list">{list.map((a) => (
          <a key={a.id} className="art-card rv inview" href={artHref(a)} {...(a.externalUrl ? { target: "_blank", rel: "noopener" } : {})}>
            <Cover a={a} />
            <span className="mono">{artDate(a.publishedAt, true)}{a.externalUrl ? " · published elsewhere" : ""}</span>
            <h2>{a.title}</h2>{a.dek && <p>{a.dek}</p>}<span className="art-more">Read →</span>
          </a>))}
          {!list.length && <p>No articles yet.</p>}</div>
      </div></section>
    </main>
  );
}
