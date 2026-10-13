// The IPO readiness check on "List your company": pure functions, run in the promoter's browser.
// Indicative only. The tests follow SEBI's ICDR rules for the main board and the 2025 SME amendments,
// plus the exchanges' SME norms (BSE SME, NSE Emerge), in simplified form.

export const PE_BANDS: Record<string, [number, number]> = {
  // Indicative trailing P/E ranges for listed Indian small and mid-cap peers; the desk replaces these with a live peer set.
  "Defence and aerospace": [35, 60],
  "Consumer and retail": [30, 50],
  "Jewellery and lifestyle": [18, 35],
  "Technology and software": [20, 40],
  "Manufacturing and engineering": [22, 38],
  "Energy, green and climate": [22, 40],
  "Agri and food": [18, 32],
  "Financial services": [12, 25],
  "Healthcare and pharma": [28, 45],
  "Chemicals and materials": [25, 40],
  "Logistics and infrastructure": [20, 35],
  "Real estate": [18, 32],
};

export type Years = [number | null, number | null, number | null]; // FY24, FY25, FY26, ₹ Cr
export type Inputs = {
  company: string; sector: string; track: "under3" | "3to5" | "over5";
  rev: Years; ebitda: Years; pat: Years; nw: Years;
  nta: number | null; debt: number | null; capital: number | null;
  gov: { publicLtd: boolean; peerAuditor: boolean; board: boolean; promoter: boolean; clean: boolean };
};
export type Check = { id: string; label: string; ok: boolean | null; note: string; fix?: string };
export type Route = "main" | "sme" | "qib" | "notyet";
export type Report = {
  route: Route; routeLabel: string; routeNote: string; score: number;
  sme: Check[]; main: Check[]; gov: Check[]; gaps: string[]; upgrade: string[];
  value: { lo: number; hi: number; pe: [number, number]; pat: number } | null;
  cagr: number | null; margin: number | null;
  timeline: { label: string; when: string }[];
};

const n = (v: number | null | undefined) => (typeof v === "number" && isFinite(v) ? v : null);
const cr = (v: number) => `₹${v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toFixed(v < 10 ? 1 : 0)} Cr`;
export const fmtCr = cr;

export function assess(i: Inputs): Report {
  const [e1, e2, e3] = i.ebitda.map(n), [w1, w2, w3] = i.nw.map(n), [r1, , r3] = i.rev.map(n), pats = i.pat.map(n);
  const known = (a: (number | null)[]) => a.every((x) => x !== null);
  const track = i.track !== "under3";
  const de = n(i.debt) !== null && w3 && w3 > 0 ? (i.debt as number) / w3 : null;

  // SME platform
  const ebitdaYears = [e1, e2, e3].filter((x) => x !== null && x >= 1).length;
  const sme: Check[] = [
    { id: "track", label: "Three years of operating track record", ok: track, note: "Company, promoter or a predecessor firm.", fix: "Build the third year of audited accounts before filing." },
    { id: "ebitda", label: "EBITDA of ₹1 Cr or more in two of the last three years", ok: known([e1, e2, e3]) ? ebitdaYears >= 2 : null, note: "The SME test SEBI set in 2025.", fix: "Get operating profit (EBITDA) above ₹1 Cr in two of three years." },
    { id: "nw", label: "Net worth of ₹1 Cr or more in each of the last two years", ok: known([w2, w3]) ? (w2 as number) >= 1 && (w3 as number) >= 1 : null, note: "BSE SME; NSE Emerge asks for positive net worth.", fix: "Lift net worth to ₹1 Cr in two consecutive years (retained profit or fresh equity)." },
    { id: "nta", label: "Net tangible assets of ₹3 Cr or more", ok: n(i.nta) !== null ? (i.nta as number) >= 3 : null, note: "BSE SME, last full year.", fix: "Net tangible assets need to reach ₹3 Cr." },
    { id: "de", label: "Debt no more than three times net worth", ok: de === null ? null : de <= 3, note: de === null ? "Add debt and net worth to check." : `Debt to equity ${de.toFixed(2)}x.`, fix: "Bring debt to equity under 3:1 before filing." },
    { id: "cap", label: "Post-issue paid-up capital within ₹25 Cr", ok: n(i.capital) === null ? null : (i.capital as number) <= 25, note: "Above ₹25 Cr, the listing has to be on the main board.", fix: "At this capital size the SME platform is closed; plan for the main board." },
  ];
  // Main board, profitability route (ICDR 6(1))
  const avg = known([e1, e2, e3]) ? ((e1 as number) + (e2 as number) + (e3 as number)) / 3 : null;
  const main: Check[] = [
    { id: "op", label: "Operating profit in each of the last three years, averaging ₹15 Cr or more", ok: avg === null ? null : (e1 as number) > 0 && (e2 as number) > 0 && (e3 as number) > 0 && avg >= 15, note: avg === null ? "Add EBITDA for all three years." : `Three-year average ${cr(avg)}.`, fix: "Average operating profit has to reach ₹15 Cr over three years, with a profit in each." },
    { id: "nw3", label: "Net worth of ₹1 Cr or more in each of the last three years", ok: known([w1, w2, w3]) ? (w1 as number) >= 1 && (w2 as number) >= 1 && (w3 as number) >= 1 : null, note: "On restated consolidated accounts.", fix: "Net worth needs to be at least ₹1 Cr in all three years." },
    { id: "nta3", label: "Net tangible assets of ₹3 Cr or more in each of the last three years", ok: n(i.nta) !== null ? (i.nta as number) >= 3 : null, note: "No more than half of it in cash or other monetary assets.", fix: "Net tangible assets need to be ₹3 Cr in each year." },
    { id: "cap10", label: "Post-issue paid-up capital of ₹10 Cr or more", ok: n(i.capital) !== null && (i.capital as number) >= 10 ? true : null, note: "The exchange norm; usually met after a bonus issue before filing.", fix: "A bonus issue before filing usually takes paid-up capital past ₹10 Cr." },
  ];
  const gov: Check[] = [
    { id: "publicLtd", label: "Converted to a public limited company", ok: i.gov.publicLtd, note: "Only a public company can file.", fix: "Convert from private to public limited (a few weeks with the ROC)." },
    { id: "peerAuditor", label: "Audited by a peer-reviewed auditor", ok: i.gov.peerAuditor, note: "The offer document needs restated accounts from one.", fix: "Appoint a peer-reviewed auditor for the current year." },
    { id: "board", label: "Independent directors and board committees in place", ok: i.gov.board, note: "Audit, nomination and stakeholder committees.", fix: "Add independent directors and set up the committees." },
    { id: "promoter", label: "Promoters hold the majority", ok: i.gov.promoter, note: "Promoters keep at least 20% locked in after the IPO.", fix: "Plan the cap table so promoters keep control through the round and the listing." },
    { id: "clean", label: "No defaults, wilful-defaulter tags or regulatory actions", ok: i.gov.clean, note: "On the company, promoters and directors.", fix: "Any default or regulatory action has to be cleared and disclosed first." },
  ];

  const capOver = n(i.capital) !== null && (i.capital as number) > 25;
  const mainOk = main.slice(0, 3).every((c) => c.ok === true);
  const smeOk = !capOver && track && sme.slice(0, 4).every((c) => c.ok === true) && sme[4].ok !== false;
  const big = (r3 ?? 0) >= 250;
  let route: Route, routeLabel: string, routeNote: string;
  if (mainOk) { route = "main"; routeLabel = "Main board, profitability route"; routeNote = "The numbers clear SEBI's profitability test for a main-board IPO (NSE and BSE)."; }
  else if (smeOk) { route = "sme"; routeLabel = "SME platform: BSE SME or NSE Emerge"; routeNote = "The numbers clear the SME tests. NSE Emerge also asks for positive free cash flow to equity in two of three years."; }
  else if (big && track) { route = "qib"; routeLabel = "Main board, institutional route"; routeNote = "Below the profitability test, a main-board IPO is still possible if at least 75% of the issue goes to institutions, which needs institutional demand."; }
  else { route = "notyet"; routeLabel = "Not yet listing-ready"; routeNote = "The tests below show what to fix. Most companies that raise a pre-IPO round start this work a year or two before filing."; }

  // Score out of 100
  let score = route === "main" ? 40 : route === "sme" ? 32 : route === "qib" ? 24 : Math.round(24 * (sme.filter((c) => c.ok === true).length / sme.length));
  const cagr = r1 && r3 && r1 > 0 ? Math.sqrt(r3 / r1) - 1 : null;
  score += cagr === null ? 0 : cagr >= 0.2 ? 15 : cagr >= 0.1 ? 10 : cagr > 0 ? 5 : 0;
  const margin = r3 && pats[2] !== null ? (pats[2] as number) / r3 : null;
  score += pats.every((p) => p !== null && p > 0) ? 10 : 0;
  score += margin !== null && margin >= 0.08 ? 5 : 0;
  score += de === null ? 0 : de <= 1 ? 10 : de <= 2 ? 6 : de <= 3 ? 3 : 0;
  score += gov.filter((g) => g.ok).length * 4;
  score = Math.max(0, Math.min(100, score));

  const fixes = (cs: Check[]) => cs.filter((c) => c.ok === false && c.fix).map((c) => c.fix as string);
  const gaps = [...(route === "notyet" ? sme : route === "qib" ? main : []), ...gov].flatMap((c) => fixes([c]));
  const upgrade = route === "sme" || route === "qib" ? fixes(main) : [];
  const pat = pats[2];
  const pe = PE_BANDS[i.sector];
  const value = pat !== null && pat > 0 && pe ? { lo: pat * pe[0], hi: pat * pe[1], pe, pat } : null;

  const timeline = route === "main"
    ? [{ label: "Pre-IPO round", when: "Now to 6 months" }, { label: "DRHP filed with SEBI", when: "6–9 months" }, { label: "SEBI observations", when: "2–4 months after filing" }, { label: "Listing", when: "12–18 months from now" }]
    : route === "sme"
      ? [{ label: "Pre-IPO round", when: "Now to 3 months" }, { label: "DRHP with the exchange", when: "3–6 months" }, { label: "Exchange approval", when: "1–3 months after filing" }, { label: "SME listing", when: "6–12 months from now" }]
      : route === "qib"
        ? [{ label: "Anchor and institutional interest", when: "Now to 6 months" }, { label: "Pre-IPO round", when: "6–12 months" }, { label: "DRHP filed with SEBI", when: "9–15 months" }, { label: "Listing", when: "18–24 months from now" }]
        : [{ label: "Fix the gaps below", when: "Now" }, { label: "One more year of audited numbers", when: "12 months" }, { label: "Pre-IPO round", when: "12–24 months" }, { label: "Filing", when: "When the tests clear" }];

  return { route, routeLabel, routeNote, score, sme, main, gov, gaps, upgrade, value, cagr, margin, timeline };
}

/** A plain-text summary that travels with the intake form to the desk. */
export function summary(i: Inputs, r: Report) {
  const y = (a: Years) => a.map((v) => (v === null ? "—" : v)).join(" / ");
  return [
    `Readiness check for ${i.company || "the company"} (${i.sector}): ${r.routeLabel}, score ${r.score}/100.`,
    `Revenue FY24/25/26: ${y(i.rev)}. EBITDA: ${y(i.ebitda)}. PAT: ${y(i.pat)}. Net worth: ${y(i.nw)}. NTA ${i.nta ?? "—"}, debt ${i.debt ?? "—"}, paid-up capital ${i.capital ?? "—"} (₹ Cr).`,
    `Governance: ${i.gov.publicLtd ? "public ltd" : "private ltd"}, ${i.gov.peerAuditor ? "peer-reviewed auditor" : "no peer-reviewed auditor"}, ${i.gov.board ? "board in place" : "no independent board yet"}, promoters ${i.gov.promoter ? "hold majority" : "below majority"}, ${i.gov.clean ? "clean record" : "has defaults or actions"}.`,
    r.gaps.length ? `To fix: ${r.gaps.join(" ")}` : "No gaps flagged.",
  ].join("\n");
}
