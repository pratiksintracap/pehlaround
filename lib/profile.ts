// A family office's investment profile: the options it chooses from, how complete it is,
// and whether a deal fits it. Shared by the dashboard, the profile form and the admin.
export const CATEGORY = ["Individual", "HUF", "Private company", "LLP", "Trust", "Family-office AIF", "Other"];
export const RESIDENCY = ["Resident in India", "Non-resident (FEMA route applies)"];
export const TICKET = ["₹50 lakh – 1 crore", "₹1–2 crore", "₹2–5 crore", "₹5–25 crore", "Above ₹25 crore"];
export const AUM = ["Under ₹50 Cr", "₹50–250 Cr", "₹250–1,000 Cr", "₹1,000–5,000 Cr", "Above ₹5,000 Cr", "Prefer not to say"];
export const HORIZON = ["Exit at listing", "1–3 years", "3–5 years", "5 years or more"];
export const STRUCTURES = ["Pre-IPO primary", "Pre-IPO secondary", "Growth round", "SME IPO-bound"];

/** Sectors an office can pick, and the words that tie a deal to each. */
export const SECTORS: [string, RegExp][] = [
  ["Defence and aerospace", /defen[cs]e|naval|aerospace|drone/i],
  ["Consumer and retail", /consumer|retail|brand|jewel|fmcg/i],
  ["Jewellery and lifestyle", /jewel|gold|lifestyle|fashion/i],
  ["Technology and software", /software|saas|\bai\b|ai-led|digital|collections platform/i],
  ["Manufacturing and engineering", /manufactur|engineer|industrial|steel|auto/i],
  ["Energy, green and climate", /energy|green|solar|ethanol|waste|climate|ev\b|renewable/i],
  ["Agri and food", /agri|food|edible|oil|grain|distill/i],
  ["Financial services", /nbfc|financ|lending|insur|bank/i],
  ["Healthcare and pharma", /health|pharma|hospital|diagnost|medic/i],
  ["Chemicals and materials", /chemical|polymer|material|specialty/i],
  ["Logistics and infrastructure", /logistic|infra|warehous|port|rail/i],
  ["Real estate", /real estate|realty|housing|land/i],
];

type OfficeLike = { category?: string | null; residency?: string | null; ticket?: string | null; aum?: string | null; city?: string | null;
  sectors?: string[] | null; structures?: string[] | null; horizon?: string | null; thesis?: string | null };

const PARTS: [string, (o: OfficeLike) => boolean][] = [
  ["How the office invests", (o) => !!o.category], ["Residency", (o) => !!o.residency], ["Ticket size", (o) => !!o.ticket],
  ["Assets under management", (o) => !!o.aum], ["City", (o) => !!o.city], ["Sectors", (o) => !!o.sectors?.length],
  ["Deal structures", (o) => !!o.structures?.length], ["Holding horizon", (o) => !!o.horizon], ["Investment thesis", (o) => (o.thesis || "").trim().length >= 20],
];
export function completeness(o: OfficeLike) {
  const missing = PARTS.filter(([, ok]) => !ok(o)).map(([k]) => k);
  return { pct: Math.round(((PARTS.length - missing.length) / PARTS.length) * 100), missing };
}

/** Why a deal fits this office's profile, or null. Sector by the deal's words; structure by its category. */
export function fit(o: OfficeLike, d: { title: string; category: string; headline?: string | null }) {
  const text = `${d.title} ${d.headline || ""}`; // the anonymised sector words, never the company name
  const sec = (o.sectors || []).find((s) => SECTORS.find(([n]) => n === s)?.[1].test(text));
  const cat = d.category.toLowerCase();
  const str = (o.structures || []).find((s) => cat.includes(s.toLowerCase().replace("pre-ipo ", "")) || (s === "Growth round" && cat.includes("growth")));
  const lc = (x: string) => (x.startsWith("Pre-IPO") || x.startsWith("SME") ? x : x[0].toLowerCase() + x.slice(1)); // acronyms keep their capitals
  if (sec && str) return `Fits your thesis: ${lc(sec)}, ${lc(str)}`;
  if (sec) return `Fits your thesis: ${lc(sec)}`;
  if (str && !(o.sectors || []).length) return `Fits your structure: ${lc(str)}`;
  return null;
}
