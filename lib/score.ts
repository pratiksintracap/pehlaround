// The Desk Score rubric. Internal: the weights and the checklist stay with the desk; the public page
// (/how-it-works#desk-score) names what the score weighs, never the weights.

export type ScorePart = { v: number; note?: string };
export type ScoreParts = Partial<Record<RubricKey, ScorePart>>;
export type RubricKey = "earnings" | "price" | "path" | "governance" | "business" | "terms";

/** The bar for a company to come to the desk at all. A rubric total below it means the company is not listed. */
export const DESK_BAR = 8.0;

export const RUBRIC: { key: RubricKey; label: string; weight: number; guide: string }[] = [
  { key: "earnings", label: "Earnings quality", weight: 0.2,
    guide: "10: three or more audited profitable years, cash conversion above 70%, GST and bank statements reconcile. 8: profitable two years, minor reconciliation gaps explained. 6: profitable only in the latest year, or cash lags profit." },
  { key: "price", label: "Entry price against listed peers", weight: 0.2,
    guide: "10: round P/E and EV/EBITDA at 40% or more below today's listed peers. 8: 20–40% below. 6: within 20% of peers. Use trailing audited numbers first; forward only as a cross-check." },
  { key: "path", label: "Path to listing", weight: 0.2,
    guide: "10: merchant banker appointed and DRHP drafted or filed, date within 18 months. 8: banker appointed, audited year chosen, 18–30 months. 6: intent only, no banker, beyond 30 months." },
  { key: "governance", label: "Governance and promoters", weight: 0.15,
    guide: "10: no material related-party flows, reputed auditor, no pledges, clean title, promoter track record checked. 8: small related-party items, disclosed and priced. 6: open questions the room has to state as risks." },
  { key: "business", label: "Business quality", weight: 0.15,
    guide: "10: order book or contracts covering 18+ months, no customer above 25%, sector tailwind, growth above 20%. 8: visibility of a year, some concentration. 6: lumpy orders or a single large customer." },
  { key: "terms", label: "Deal terms", weight: 0.1,
    guide: "10: primary or a clean secondary, information rights, protection if the IPO slips past a date. 8: standard terms, information rights only. 6: secondary with no rights beyond the shares." },
];

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Weighted total when every area is marked; null while any is missing. */
export function rubricTotal(parts: ScoreParts | null | undefined): number | null {
  if (!parts) return null;
  let t = 0;
  for (const r of RUBRIC) {
    const p = parts[r.key];
    if (!p || !isFinite(p.v)) return null;
    t += r.weight * p.v;
  }
  return round1(t);
}

/** Reads the admin form: sp_<key> (0–10) and sn_<key> (a one-line reason). */
export function partsFromForm(f: FormData): ScoreParts {
  const out: ScoreParts = {};
  for (const r of RUBRIC) {
    const raw = String(f.get(`sp_${r.key}`) ?? "").trim();
    const v = parseFloat(raw);
    const note = String(f.get(`sn_${r.key}`) ?? "").trim().slice(0, 300);
    if (raw !== "" && isFinite(v)) out[r.key] = { v: round1(Math.min(10, Math.max(0, v))), ...(note ? { note } : {}) };
  }
  return out;
}
