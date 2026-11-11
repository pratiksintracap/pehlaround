// The closing of one allocation, after the office and the company agree: term sheet, documents, funds, shares credited.
// The desk records the date of each step; the office sees the same four steps on its dashboard. Pure, so it is tested
// without a database. No "server-only" here so the tests can import it.

/** Dates as YYYY-MM-DD. fundsDue is the date the desk asked for funds by, shown until funds are received. */
export type Closing = { termSheet?: string; documents?: string; funds?: string; credited?: string; fundsDue?: string };
export type ClosingKey = "termSheet" | "documents" | "funds" | "credited";

export const CLOSING_STEPS: { key: ClosingKey; label: string; told: string }[] = [
  { key: "termSheet", label: "Term sheet agreed", told: "the term sheet is agreed" },
  { key: "documents", label: "Documents signed", told: "the documents are signed" },
  { key: "funds", label: "Funds received", told: "your funds are received" },
  { key: "credited", label: "Shares credited", told: "the shares are credited to your demat" },
];

// The request's status implies steps even when the desk recorded no date: "Documents" means the term sheet is agreed.
const IMPLIED: Record<string, number> = { "Term sheet": 1, Documents: 2, Allotted: 4 };

export type ClosingStep = { key: ClosingKey; label: string; date: string | null; done: boolean; now: boolean };

/** The four steps for one request: done when the desk dated it, or when the status has moved past it. */
export function closingSteps(status: string, c: Closing | null | undefined): ClosingStep[] {
  const implied = IMPLIED[status] ?? 0;
  const done = CLOSING_STEPS.map((s, i) => !!c?.[s.key] || i < implied);
  // A later step being done means the earlier ones are too (funds cannot arrive before the documents).
  for (let i = done.length - 2; i >= 0; i--) if (done[i + 1]) done[i] = true;
  const next = done.indexOf(false);
  return CLOSING_STEPS.map((s, i) => ({ key: s.key, label: s.label, date: c?.[s.key] ?? null, done: done[i], now: i === next }));
}

/** A request is "closing" once anything past the indication has happened and it is not finished or withdrawn. */
export function isClosing(status: string, c: Closing | null | undefined) {
  if (status === "Withdrawn") return false;
  const steps = closingSteps(status, c);
  return steps.some((s) => s.done) && !steps.every((s) => s.done);
}

/** The steps the desk has just dated for the first time, in order. */
export function freshSteps(before: Closing | null | undefined, after: Closing) {
  return CLOSING_STEPS.filter((s) => after[s.key] && !before?.[s.key]);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Read the desk's form: each date is kept only if it is a real YYYY-MM-DD. */
export function closingFrom(get: (k: string) => string): Closing {
  const out: Closing = {};
  for (const k of ["termSheet", "documents", "funds", "credited", "fundsDue"] as const) { const v = get(k).trim(); if (DAY.test(v) && !isNaN(Date.parse(v))) out[k] = v; }
  return out;
}

export const fmtIso = (iso: string | null | undefined) => (iso ? new Date(iso + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");
