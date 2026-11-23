import { cmp, sub } from "./decimal";

/*
 * Matching a raise to lenders on: lender thesis (segment, and headroom left under the lender's exposure target,
 * measured on amount outstanding), instrument, interest-rate band, risk appetite (security levels), and ticket size.
 * Each criterion is shown separately so the team can see why a lender fits or doesn't.
 */

export type MatchInputRaise = {
  amount: string;
  filledAmount: string;
  lenderRate: string | null;
  securityLevelId: string | null;
  instrumentId?: string | null;
  /** Segment the funds go to. When unset, the borrower's book segments are used. */
  segmentId?: string | null;
  borrowerSegmentIds: string[];
};

export type MatchInputLender = {
  id: string;
  name: string;
  active: boolean;
  minTicket: string | null;
  maxTicket: string | null;
  minRate: string | null;
  maxRate: string | null;
  segmentIds: string[];
  securityLevelIds: string[];
  instrumentIds?: string[];
  /** segmentId -> remaining headroom (target - outstanding), or null when the lender set no target for it. */
  headroom?: Record<string, string | null>;
};

export type Check = "pass" | "fail" | "unknown";

export type MatchResult = {
  lenderId: string;
  lenderName: string;
  thesis: Check;
  instrument: Check;
  rateBand: Check;
  riskAppetite: Check;
  ticket: Check;
  /** Headroom under the target for the segment funded, when the lender has a target for it. */
  headroom: string | null;
  /** True when the segment matches but the lender's exposure target is already used up. */
  targetReached: boolean;
  passed: number;
  isMatch: boolean;
};

export function matchLender(r: MatchInputRaise, l: MatchInputLender): MatchResult {
  const raiseSegments = r.segmentId ? [r.segmentId] : r.borrowerSegmentIds;
  const overlap = raiseSegments.filter((s) => l.segmentIds.includes(s));
  let thesis: Check = l.segmentIds.length === 0 || raiseSegments.length === 0 ? "unknown" : overlap.length ? "pass" : "fail";
  let headroom: string | null = null;
  let targetReached = false;
  if (thesis === "pass" && l.headroom) {
    const rooms = overlap.map((s) => l.headroom![s] ?? null);
    const withTarget = rooms.filter((x): x is string => x != null);
    if (withTarget.length === rooms.length && withTarget.length > 0) {
      headroom = withTarget.reduce((a, b) => (cmp(a, b) >= 0 ? a : b));
      if (cmp(headroom, "0") <= 0) {
        thesis = "fail";
        targetReached = true;
      }
    }
  }

  const lInstruments = l.instrumentIds ?? [];
  const instrument: Check =
    !r.instrumentId || lInstruments.length === 0 ? "unknown" : lInstruments.includes(r.instrumentId) ? "pass" : "fail";

  let rateBand: Check = "unknown";
  if (r.lenderRate != null && (l.minRate != null || l.maxRate != null)) {
    const okMin = l.minRate == null || cmp(r.lenderRate, l.minRate) >= 0;
    const okMax = l.maxRate == null || cmp(r.lenderRate, l.maxRate) <= 0;
    rateBand = okMin && okMax ? "pass" : "fail";
  }

  const riskAppetite: Check =
    r.securityLevelId == null || l.securityLevelIds.length === 0
      ? "unknown"
      : l.securityLevelIds.includes(r.securityLevelId)
        ? "pass"
        : "fail";

  // Ticket fit: the lender's minimum ticket must fit in what is still unfilled.
  let ticket: Check = "unknown";
  if (l.minTicket != null || l.maxTicket != null) {
    const remaining = sub(r.amount, r.filledAmount);
    ticket = l.minTicket == null || cmp(remaining, l.minTicket) >= 0 ? "pass" : "fail";
  }

  const checks = [thesis, instrument, rateBand, riskAppetite, ticket];
  const passed = checks.filter((c) => c === "pass").length;
  return {
    lenderId: l.id,
    lenderName: l.name,
    thesis,
    instrument,
    rateBand,
    riskAppetite,
    ticket,
    headroom,
    targetReached,
    passed,
    isMatch: l.active && !checks.includes("fail") && passed > 0,
  };
}

export function rankLenders(r: MatchInputRaise, lenders: MatchInputLender[]): MatchResult[] {
  return lenders
    .map((l) => matchLender(r, l))
    .sort((a, b) => Number(b.isMatch) - Number(a.isMatch) || b.passed - a.passed || a.lenderName.localeCompare(b.lenderName));
}
