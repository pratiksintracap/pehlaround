import type { Metadata } from "next";
import { SITE_URL, DESK_EMAIL } from "@/lib/site";

export const BRAND = "Before the Bell";
const OG = { url: "/og.jpg", width: 1200, height: 630, alt: "Before the Bell: a front-row seat to India’s next listings." };

/** Metadata for a public page: a canonical URL (so utm/ref links, the old domains and the vercel.app host all
 *  consolidate onto beforethebell.in), Open Graph and Twitter cards that keep the share image.
 *  Next replaces a parent's openGraph wholesale, so every page has to restate the image; this does it once. */
export function pageMeta(o: { path: string; title: string; description: string; image?: string | { url: string; width?: number; height?: number; alt?: string }; type?: "website" | "article";
  publishedTime?: string; modifiedTime?: string; authors?: string[]; noindex?: boolean; absoluteTitle?: boolean }): Metadata {
  const img = o.image ? (typeof o.image === "string" ? { url: o.image, width: 1200, height: 630, alt: o.title } : o.image) : OG;
  const full = o.absoluteTitle ? o.title : `${o.title} · ${BRAND}`;
  return {
    title: o.absoluteTitle ? { absolute: o.title } : o.title,
    description: o.description,
    alternates: { canonical: o.path },
    openGraph: { type: o.type || "website", siteName: BRAND, locale: "en_IN", url: o.path, title: full, description: o.description, images: [img],
      ...(o.type === "article" ? { publishedTime: o.publishedTime, modifiedTime: o.modifiedTime, authors: o.authors } : {}) },
    twitter: { card: "summary_large_image", title: full, description: o.description, images: [img.url] },
    ...(o.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Article titles run long; the brand suffix is dropped when it would push the title past what Google shows. */
export const fitsWithBrand = (t: string) => t.length + BRAND.length + 3 <= 65;

const abs = (p: string) => (p.startsWith("http") ? p : SITE_URL + p);
const ORG_ID = `${SITE_URL}/#org`;

export function orgLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": ORG_ID, name: BRAND, url: SITE_URL, logo: abs("/icon-512.png"), email: DESK_EMAIL,
        description: "A deal desk for pre-IPO and IPO-bound Indian companies, for family offices, funds and qualified investors. Operated by SintraCap Advisors LLP.",
        address: { "@type": "PostalAddress", streetAddress: "602 Lodha Supremus, Senapati Bapat Marg, Lower Parel", addressLocality: "Mumbai", postalCode: "400013", addressRegion: "Maharashtra", addressCountry: "IN" },
        parentOrganization: { "@type": "Organization", name: "SintraCap Advisors LLP", url: "https://sintracap.in" },
        areaServed: "IN" },
      { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: SITE_URL, name: BRAND, inLanguage: "en-IN", publisher: { "@id": ORG_ID } },
    ],
  };
}

export function crumbsLd(items: [string, string][]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })) };
}

export function articleLd(a: { slug: string; title: string; dek?: string | null; author: string; publishedAt: Date; updatedAt: Date; image: string }) {
  const person = a.author && !/team$/i.test(a.author);
  return { "@context": "https://schema.org", "@type": "Article", headline: a.title.slice(0, 110), description: a.dek || undefined,
    image: [abs(a.image)], datePublished: a.publishedAt.toISOString(), dateModified: (a.updatedAt > a.publishedAt ? a.updatedAt : a.publishedAt).toISOString(),
    author: person ? { "@type": "Person", name: a.author } : { "@type": "Organization", name: BRAND, url: SITE_URL },
    publisher: { "@id": ORG_ID }, mainEntityOfPage: abs(`/articles/${a.slug}`), inLanguage: "en-IN", isAccessibleForFree: true };
}

/** FAQPage from the <details><summary> blocks a content page already shows, so the markup always matches the page. */
export function faqLd(html: string) {
  const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
  const qa = [...html.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map((m) => ({ q: strip(m[1]), a: strip(m[2]) })).filter((x) => x.q && x.a);
  if (!qa.length) return null;
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) };
}

export function videoLd() {
  return { "@context": "https://schema.org", "@type": "VideoObject", name: "Before the Bell, in under a minute",
    description: "What Before the Bell is, how a company reaches the desk, and what an approved investor sees.",
    thumbnailUrl: [abs("/film/poster.jpg")], contentUrl: abs("/film/before-the-bell.mp4"), uploadDate: "2026-10-15T09:00:00+05:30", duration: "PT48S", publisher: { "@id": ORG_ID } };
}

/** Inline JSON-LD; "<" is escaped so no field can close the script tag. */
export const ld = (o: unknown) => ({ __html: JSON.stringify(o).replace(/</g, "\\u003c") });
