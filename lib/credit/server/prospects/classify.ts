/**
 * Facts derived from RBI's register to help find likely borrowers. Nothing here hides or deletes a prospect;
 * these only drive the default "likely borrowers" view and filters.
 */

/** State from the CIN's two-letter registration code (MCA codes; PN = Pune ROC, TZ = Coimbatore ROC). */
const STATE_BY_CIN_CODE: Record<string, string> = {
  AN: "Andaman and Nicobar Islands", AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar",
  CH: "Chandigarh", CT: "Chhattisgarh", DD: "Daman and Diu", DL: "Delhi", DN: "Dadra and Nagar Haveli", GA: "Goa",
  GJ: "Gujarat", HP: "Himachal Pradesh", HR: "Haryana", JH: "Jharkhand", JK: "Jammu and Kashmir", KA: "Karnataka",
  KL: "Kerala", LA: "Ladakh", LD: "Lakshadweep", MH: "Maharashtra", ML: "Meghalaya", MN: "Manipur",
  MP: "Madhya Pradesh", MZ: "Mizoram", NL: "Nagaland", OR: "Odisha", PB: "Punjab", PN: "Maharashtra",
  PY: "Puducherry", RJ: "Rajasthan", SK: "Sikkim", TG: "Telangana", TN: "Tamil Nadu", TR: "Tripura",
  TS: "Telangana", TZ: "Tamil Nadu", UP: "Uttar Pradesh", UR: "Uttarakhand", UT: "Uttarakhand", WB: "West Bengal",
};

export function stateFromCin(cin: string | null | undefined): string | null {
  if (!cin || cin.length < 8) return null;
  return STATE_BY_CIN_CODE[cin.slice(6, 8).toUpperCase()] ?? null;
}

/** SQL CASE expression (on a column of CINs) matching stateFromCin, for backfills. */
export function stateCaseSql(col: string): string {
  const whens = Object.entries(STATE_BY_CIN_CODE).map(([k, v]) => `when '${k}' then '${v}'`).join(" ");
  return `case upper(substr(${col}, 7, 2)) ${whens} else null end`;
}

/**
 * RBI categories that are not lending businesses with their own loan book, so they don't raise funding to
 * on-lend: account aggregators, P2P platforms, core investment / holding companies, primary dealers, mortgage
 * guarantee companies, and Type-I NBFCs (which by definition take no public funds and have no customers).
 */
export const NOT_LENDING_TYPES = ["AA", "P2P", "CIC", "NOFHC", "PD", "MGC", "Type-I"] as const;

/** Upper and Middle layer NBFCs are above the Base-layer size, so well beyond a small borrower. */
export const BORROWER_LAYERS = ["Base Layer"] as const;

/**
 * Long-term grade from a rating as written by the agency ("CRISIL BBB-/Stable", "[ICRA]BB+", "ACUITE BBB- | Stable",
 * "IVR BB / Negative", "CARE BBB; Stable", "IND BB+"). Short-term ratings (A1, A4+) and anything unreadable give null.
 */
export function ratingGrade(rating: string | null | undefined): string | null {
  if (!rating) return null;
  const s = rating
    .toUpperCase()
    .replace(/\[ICRA\]|ICRA|CRISIL|CARE|ACUITE|ACUITÉ|IVR|IND|BWR|PP-MLD|\(CE\)|\(SO\)|PR\b/g, " ");
  const m = s.match(/(?:^|[^A-Z])(AAA|AA|BBB|BB|A|B|C|D)(?:[+-])?(?![A-Z0-9])/);
  return m ? m[1] : null;
}

/** Grades lenders on the platform are most likely to be the answer for: investment grade at the bottom and below. */
export const PRIORITY_GRADES = ["BBB", "BB", "B", "C", "D"];

/**
 * How likely a prospect is to need the platform, 0–100. Explained on screen; the same rules run in SQL for sorting
 * (prioritySql in admin/prospects.ts must match).
 *  - size in the target band 40, size unknown 15, outside 0
 *  - rated BBB or below 20, unrated 10, rated A or above 5; negative outlook or "issuer not cooperating" +10
 *  - known lenders: 3 or more 15, 1–2 10
 *  - a named contact 10, else a registered email 5
 *  - already onboarded, not a fit or do-not-contact: 0
 */
export function priorityScore(
  p: {
    sizeCr: number | null;
    ratingGrade: string | null;
    rating: string | null;
    ratingOutlook: string | null;
    lenderCount: number;
    contactName: string | null;
    contactEmail: string | null;
    registeredEmail: string | null;
    status: string;
  },
  band: { minCr: number; maxCr: number },
): number {
  if (["onboarded", "not_a_fit", "do_not_contact"].includes(p.status)) return 0;
  let s = 0;
  s += p.sizeCr == null ? 15 : p.sizeCr >= band.minCr && p.sizeCr <= band.maxCr ? 40 : 0;
  s += !p.rating ? 10 : p.ratingGrade && PRIORITY_GRADES.includes(p.ratingGrade) ? 20 : 5;
  if (/negative|inc|not cooperating/i.test(p.ratingOutlook ?? "")) s += 10;
  s += p.lenderCount >= 3 ? 15 : p.lenderCount >= 1 ? 10 : 0;
  s += p.contactName ? 10 : p.contactEmail || p.registeredEmail ? 5 : 0;
  return s;
}
