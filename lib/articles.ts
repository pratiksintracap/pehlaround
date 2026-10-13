import "server-only";
import { and, desc, eq, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cachedPublic } from "@/lib/cache";
import { articles } from "@/db/schema";

const articleList = cachedPublic(async (limit: number) => {
  const db = await getDb();
  return db.select().from(articles).where(and(eq(articles.published, true), lte(articles.publishedAt, new Date()))).orderBy(desc(articles.publishedAt)).limit(limit);
}, "articles");
export async function listArticles(limit = 100) { return articleList(limit); }
const articleBySlug = cachedPublic(async (slug: string) => {
  const db = await getDb();
  const [a] = await db.select().from(articles).where(eq(articles.slug, slug));
  return a ?? null;
}, "article");
export async function getArticle(slug: string) { return articleBySlug(slug); }
export const artDate = (d: Date, long = false) => d.toLocaleDateString("en-IN", long ? { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" } : { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
export const artHref = (a: { slug: string; externalUrl: string | null }) => a.externalUrl || `/articles/${a.slug}`;
