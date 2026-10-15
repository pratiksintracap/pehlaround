import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { listDeals } from "@/lib/deals";
import { listArticles } from "@/lib/articles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [deals, arts] = await Promise.all([listDeals(), listArticles(500)]);
  const fixed = ["", "/deals", "/how-it-works", "/about", "/founders", "/webinars", "/articles", "/press", "/register", "/legal"]
    .map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  return [
    ...fixed,
    ...deals.map((d) => ({ url: `${SITE_URL}/deals/${d.slug}`, lastModified: d.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...arts.filter((a) => !a.externalUrl).map((a) => ({ url: `${SITE_URL}/articles/${a.slug}`, lastModified: a.updatedAt ?? a.publishedAt, priority: 0.6 })),
  ];
}
