import { desc } from "drizzle-orm";
import { requireDesk } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { articles } from "@/db/schema";
import { Msg } from "@/components/AdminBits";

export default async function AdminArticles({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const me = await requireDesk();
  const { msg } = await searchParams;
  const db = await getDb();
  const list = await db.select().from(articles).orderBy(desc(articles.publishedAt));
  return (
    <>
      <Msg msg={msg} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 30, margin: "6px 0 16px" }}>Articles</h1><a className="btn primary" href="/admin/articles/new">Write an article</a></div>
      <p className="fine" style={{ marginBottom: 12 }}>The latest ten published articles run in the strip under the home-page hero; all of them are listed at /articles. For a piece published on another site, fill in its link and the strip points there.</p>
      <div className="cmpwrap"><table className="cmp plain"><thead><tr><th>Date</th><th>Title</th><th>Where</th><th>Shown</th><th /></tr></thead><tbody>
        {list.map((a) => <tr key={a.id}><td>{a.publishedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td><th scope="row">{a.title}</th>
          <td>{a.externalUrl ? "External link" : `/articles/${a.slug}`}</td><td>{a.published ? (a.publishedAt > new Date() ? "Scheduled" : "Live") : "Draft"}</td>
          <td><a className="btn sm" href={`/admin/articles/${a.id}`}>Edit</a></td></tr>)}
      </tbody></table></div>
    </>
  );
}
