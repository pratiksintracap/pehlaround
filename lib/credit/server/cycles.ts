/*
 * Drawdown cycles. Each borrower draws down on its own cycle: monthly, quarterly or yearly. A raise covers one
 * period of its borrower's cycle, identified by the first day of its start month (`cycle_start`).
 * Pure functions only (no DB, no server-only), so screens, drafts and tests can share them.
 */

export const DRAWDOWN_CYCLES = ["monthly", "quarterly", "yearly"] as const;
export type DrawdownCycle = (typeof DRAWDOWN_CYCLES)[number];

/** Length of one period of each cycle, in months. */
export const CYCLE_MONTHS: Record<DrawdownCycle, number> = { monthly: 1, quarterly: 3, yearly: 12 };

const CYCLE_NAME: Record<DrawdownCycle, string> = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isDrawdownCycle(v: unknown): v is DrawdownCycle {
  return typeof v === "string" && (DRAWDOWN_CYCLES as readonly string[]).includes(v);
}

/** "Monthly" / "Quarterly" / "Yearly". */
export function cycleName(cycle: string): string {
  return isDrawdownCycle(cycle) ? CYCLE_NAME[cycle] : cycle;
}

function ym(start: string | Date): [number, number] {
  if (start instanceof Date) {
    if (Number.isNaN(start.getTime())) throw new Error("Invalid date");
    return [start.getUTCFullYear(), start.getUTCMonth() + 1];
  }
  const m = String(start).trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) throw new Error("Expected YYYY-MM or YYYY-MM-DD");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error("Month out of range");
  if (m[3] !== undefined) {
    const d = Number(m[3]);
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    if (d < 1 || d > last) throw new Error("Day out of range");
  }
  return [y, mo];
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Adds whole months to a (year, month) pair. */
function addMonths(y: number, m: number, n: number): [number, number] {
  const idx = y * 12 + (m - 1) + n;
  return [Math.floor(idx / 12), (idx % 12) + 1];
}

/** First day of the month containing `start`, as YYYY-MM-01. Accepts YYYY-MM, YYYY-MM-DD or a Date (UTC). */
export function normaliseCycleStart(start: string | Date): string {
  const [y, m] = ym(start);
  return iso(y, m, 1);
}

/** Last day of the period that starts in `start`'s month, as YYYY-MM-DD. */
export function cycleEnd(start: string | Date, cycle: DrawdownCycle): string {
  const [y, m] = ym(start);
  const [ey, em] = addMonths(y, m, CYCLE_MONTHS[cycle] - 1);
  return iso(ey, em, new Date(Date.UTC(ey, em, 0)).getUTCDate());
}

/** First day of the period immediately after this one. */
export function nextCycleStart(start: string | Date, cycle: DrawdownCycle): string {
  const [y, m] = ym(start);
  const [ny, nm] = addMonths(y, m, CYCLE_MONTHS[cycle]);
  return iso(ny, nm, 1);
}

/**
 * Display label for a raise's period: monthly "Nov 2026", quarterly "Oct–Dec 2026" (or "Nov 2026–Jan 2027"
 * across a year end), yearly "Apr 2026–Mar 2027".
 */
export function cycleLabel(start: string | Date, cycle: DrawdownCycle | string): string {
  const [y, m] = ym(start);
  const c: DrawdownCycle = isDrawdownCycle(cycle) ? cycle : "monthly";
  if (c === "monthly") return `${MONTHS[m - 1]} ${y}`;
  const [ey, em] = addMonths(y, m, CYCLE_MONTHS[c] - 1);
  return ey === y ? `${MONTHS[m - 1]}–${MONTHS[em - 1]} ${y}` : `${MONTHS[m - 1]} ${y}–${MONTHS[em - 1]} ${ey}`;
}
