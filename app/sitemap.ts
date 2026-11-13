import { CREDIT_GUIDES } from "@/lib/credit";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { listDeals } from "@/lib/deals";
import { listArticles } from "@/lib/articles";
import { IPO_DATA } from "@/lib/ipo-calendar";
import { GUIDES } from "@/lib/promoter-guides";
import { INVESTOR_GUIDES } from "@/lib/investor-guides";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [deals, arts] = await Promise.all([listDeals(), listArticles(500)]);
  const latest = [...deals.map((d) => d.updatedAt), ...arts.map((a) => a.publishedAt)].filter(Boolean).sort((a, b) => +b - +a)[0] || new Date();
  const PRI: Record<string, number> = { "": 1, "/deals": 0.9, "/pre-ipo-investing": 0.9, "/how-it-works": 0.8, "/articles": 0.8, "/ipo-calendar": 0.8, "/raise": 0.8, "/sell": 0.7, "/partners": 0.7, "/private-credit": 0.7, "/private-credit/lenders": 0.6, "/private-credit/borrowers": 0.6, "/private-credit/how-it-works": 0.5, "/private-credit/confidentiality": 0.4, "/private-credit/guides": 0.5, "/about": 0.6, "/founders": 0.6, "/register": 0.6, "/webinars": 0.4, "/legal": 0.2 };
  const fixed = Object.keys(PRI).map((p) => ({ url: `${SITE_URL}${p}`, lastModified: p === "" || p === "/deals" || p === "/articles" ? latest : p === "/ipo-calendar" ? new Date(`${IPO_DATA.asOf}T09:00:00+05:30`) : undefined,
    changeFrequency: (p === "/legal" ? "yearly" : "weekly") as "yearly" | "weekly", priority: PRI[p] }));
  return [
    ...fixed,
    ...INVESTOR_GUIDES.map((g) => ({ url: `${SITE_URL}/pre-ipo-investing/${g.slug}`, lastModified: new Date(`${g.updated}T09:00:00+05:30`), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...CREDIT_GUIDES.map((g) => ({ url: `${SITE_URL}/private-credit/guides/${g.slug}`, lastModified: new Date("2026-11-13T09:00:00+05:30"), changeFrequency: "monthly" as const, priority: 0.5 })),
    ...GUIDES.map((g) => ({ url: `${SITE_URL}/raise/${g.slug}`, lastModified: new Date(`${g.updated}T09:00:00+05:30`), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...deals.map((d) => ({ url: `${SITE_URL}/deals/${d.slug}`, lastModified: d.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...arts.filter((a) => !a.externalUrl && a.publishedAt <= new Date()).map((a) => ({ url: `${SITE_URL}/articles/${a.slug}`, lastModified: a.updatedAt ?? a.publishedAt, priority: 0.6 })),
  ];
}
