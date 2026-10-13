// Picks an article cover's subject, label and colours from its title, so every article gets
// a bold, consistent picture without anyone uploading one.

export type Motif = "tower" | "ship" | "percent" | "drop" | "globe" | "shield" | "bell" | "bars";
export type Theme = { motif: Motif; label: string; from: string; to: string; accent: string };

const THEMES: Record<Motif, Omit<Theme, "motif">> = {
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
  return { motif: m, ...THEMES[m] };
}
