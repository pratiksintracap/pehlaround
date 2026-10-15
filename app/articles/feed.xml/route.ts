import { listArticles, artHref } from "@/lib/articles";
import { SITE_URL } from "@/lib/site";

// RSS for the desk's articles: picked up by feed readers, Google News discovery and LinkedIn/Feedly users.
export const dynamic = "force-dynamic";
const x = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));

export async function GET() {
  const arts = (await listArticles(50)).filter((a) => a.publishedAt <= new Date());
  const items = arts.map((a) => {
    const link = a.externalUrl || `${SITE_URL}${artHref(a)}`;
    return `<item><title>${x(a.title)}</title><link>${x(link)}</link><guid isPermaLink="${a.externalUrl ? "false" : "true"}">${x(a.externalUrl ? `${SITE_URL}/articles/${a.slug}` : link)}</guid><pubDate>${a.publishedAt.toUTCString()}</pubDate>${a.dek ? `<description>${x(a.dek)}</description>` : ""}<author>desk@beforethebell.in (${x(a.author)})</author></item>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Before the Bell · Articles</title><link>${SITE_URL}/articles</link><atom:link href="${SITE_URL}/articles/feed.xml" rel="self" type="application/rss+xml"/><description>Notes from the desk on Indian IPOs, pre-IPO rounds and the market.</description><language>en-in</language>${arts[0] ? `<lastBuildDate>${arts[0].publishedAt.toUTCString()}</lastBuildDate>` : ""}${items}</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
