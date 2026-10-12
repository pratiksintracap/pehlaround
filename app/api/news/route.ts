// Latest Indian capital-markets headlines for the home-page news strip (Google News RSS, India edition).
import { NextResponse } from "next/server";
export const revalidate = 900;
const QUERY = '(IPO OR SEBI OR Sensex OR Nifty OR "pre-IPO" OR "block deal") when:2d';
const FEED = 'https://news.google.com/rss/search?hl=en-IN&gl=IN&ceid=IN:en&q=' + encodeURIComponent(QUERY);

function decode(s: string) {
  return s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function pick(block: string, tag: string) {
  const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'));
  return m ? decode(m[1]) : '';
}


export async function GET() {
  try {
    const r = await fetch(FEED, { headers: { "user-agent": "pehlaround.in news strip" }, next: { revalidate: 900 } });
    if (!r.ok) throw new Error("feed " + r.status);
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map((m) => {
      const b = m[1];
      const source = pick(b, "source");
      let title = pick(b, "title");
      if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
      const d = new Date(pick(b, "pubDate"));
      return { title, source, link: pick(b, "link"),
        date: isNaN(+d) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }) };
    }).filter((i) => i.title && i.link);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=3600" } });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
