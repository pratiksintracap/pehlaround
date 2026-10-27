import { SITE_URL } from "@/lib/site";

type TeaserDeal = { slug: string; title: string; category: string; headline: string; listingLabel: string; score: number | null; company: string };

/**
 * A blind teaser for forwarding on WhatsApp: the anonymised title, structure, one-liner, target listing and Desk Score,
 * with the sharer's invite code so a registration is credited to them. Never the company's name, round size or price.
 */
export function teaser(d: TeaserDeal, refCode?: string | null) {
  const url = `${SITE_URL}/deals/${d.slug}${refCode ? `?ref=${refCode}` : ""}`;
  const lines = [
    `A pre-IPO company on Before the Bell: ${d.title} (${d.category}).`,
    d.headline,
    `Target listing: ${d.listingLabel}.${d.score != null ? ` Desk Score ${d.score.toFixed(1)}/10.` : ""}`,
    `The company's name, round and pitch deck open to approved investors: ${url}`,
  ];
  let text = lines.filter(Boolean).join("\n\n");
  // Belt and braces: an anonymised field that slipped the company's name in never leaves the site.
  const name = d.company.trim();
  if (name.length >= 3) text = text.split(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join("this company");
  return { url, text, wa: `https://wa.me/?text=${encodeURIComponent(text)}` };
}
