/** Pure date rules for quarterly financials (no DB access; safe to import anywhere). */

export function isQuarterEnd(d: string): boolean {
  return /^\d{4}-(03-31|06-30|09-30|12-31)$/.test(d);
}

/** The most recent quarter end strictly before `today`. */
export function lastQuarterEnd(today = new Date()): string {
  const y = today.getUTCFullYear();
  const ends = [`${y - 1}-12-31`, `${y}-03-31`, `${y}-06-30`, `${y}-09-30`, `${y}-12-31`];
  const t = today.toISOString().slice(0, 10);
  return ends.filter((e) => e < t).at(-1)!;
}

/** True when the latest figures on file are older than the last completed quarter. */
export function financialsBehind(latestPeriodEnd: string | null | undefined, today = new Date()): boolean {
  return !latestPeriodEnd || latestPeriodEnd < lastQuarterEnd(today);
}

