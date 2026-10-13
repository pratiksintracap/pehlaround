// Picks an article cover's subject, label and colours from its title, so every article gets
// a bold, consistent picture without anyone uploading one.

export type Motif = "tower" | "ship" | "percent" | "drop" | "globe" | "shield" | "bell" | "bars";
export type Theme = { motif: Motif; label: string; from: string; to: string; accent: string; photo: string };

const THEMES: Record<Motif, Omit<Theme, "motif" | "photo">> = {
  tower:   { label: "Telecom & tech",  from: "#6d28d9", to: "#db2777", accent: "#fde047" },
  ship:    { label: "Defence",         from: "#1d4ed8", to: "#06b6d4", accent: "#fde047" },
  percent: { label: "Rates",           from: "#ea580c", to: "#e11d48", accent: "#fff3a3" },
  drop:    { label: "Energy",          from: "#047857", to: "#84cc16", accent: "#fef08a" },
  globe:   { label: "Money flows",     from: "#0284c7", to: "#6366f1", accent: "#fb7185" },
  shield:  { label: "Regulation",      from: "#7e22ce", to: "#2563eb", accent: "#6ee7b7" },
  bell:    { label: "IPO watch",       from: "#f59e0b", to: "#dc2626", accent: "#fff7c2" },
  bars:    { label: "Markets",         from: "#2563eb", to: "#7c3aed", accent: "#34d399" },
};

export function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

export function coverTheme(a: { slug: string; title: string }): Theme {
  const t = (a.title + " " + a.slug).toLowerCase();
  const m: Motif =
    /jio|telecom|5g|platforms? and|digital/.test(t) ? "tower" :
    /defen[cs]e|navy|naval|shipyard|order[- ]book/.test(t) ? "ship" :
    /rbi|repo|rate hike|rate cut|interest/.test(t) ? "percent" :
    /ethanol|e20|distiller|grain|fuel|energy|solar/.test(t) ? "drop" :
    /foreign|fii|fpi|rupee|outflow|selling/.test(t) ? "globe" :
    /sebi|regulat|warning|rule|law|compliance/.test(t) ? "shield" :
    /ipo|listing|calendar|issue/.test(t) ? "bell" : "bars";
  return { motif: m, photo: MOTIF_PHOTO[m], ...THEMES[m] };
}

// Editorial photographs (Unsplash licence: free for commercial use, no attribution required; credited anyway).
// A photo per article, and a default per subject for articles published later without one.
const SLUG_PHOTO: Record<string, string> = {
  "jio-platforms-mega-ipo-season": "photo-1592762323693-ac6e4af302a6",
  "eight-ipos-one-week-october-calendar": "photo-1569758267239-d08deb78bb1a",
  "defence-order-books-execution-test": "photo-1708342421457-9c59f4843fe1",
  "rbi-rate-hike-private-rounds": "photo-1565371767810-ef913a6c8315",
  "e20-reached-what-next-grain-distilleries": "photo-1639941798780-04529d362f9a",
  "foreign-selling-weaker-rupee-pre-ipo-prices": "photo-1759430710977-a557a49897ff",
  "sebi-unlisted-platforms-private-placement": "photo-1562564055-71e051d33c19",
  "september-record-ipo-month-read-closely": "photo-1595658658481-d53d3f999875",
};
const MOTIF_PHOTO: Record<Motif, string> = {
  tower: "photo-1592762323693-ac6e4af302a6", ship: "photo-1708342421457-9c59f4843fe1", percent: "photo-1565371767810-ef913a6c8315",
  drop: "photo-1639941798780-04529d362f9a", globe: "photo-1759430710977-a557a49897ff", shield: "photo-1562564055-71e051d33c19",
  bell: "photo-1569758267239-d08deb78bb1a", bars: "photo-1611974789855-9c2a0a7236a3",
};
export const unsplash = (id: string, w = 1200, h = 630) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=75`;

/** The cover photo URL for an article: its own image if the desk set one, else a chosen editorial photo. */
export function coverPhoto(a: { slug: string; title: string; image?: string | null }, w = 1200, h = 630) {
  if (a.image) return a.image;
  return unsplash(SLUG_PHOTO[a.slug] || MOTIF_PHOTO[coverTheme(a).motif], w, h);
}
