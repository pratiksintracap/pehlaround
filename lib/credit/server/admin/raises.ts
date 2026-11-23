import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  allocationMovements,
  allocations,
  approvals,
  borrowers,
  borrowerSegments,
  dealShares,
  diligenceL1,
  instruments,
  lenderInstruments,
  lenders,
  lenderSecurityLevels,
  lenderSegmentTargets,
  raiseEconomics,
  raiseTermsHistory,
  raises,
  securityLevels,
  segments,
  users,
} from "@/lib/credit/schema";
import type { Tx } from "@/lib/credit/db";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optRate, optText, reqAmount, uuidOrThrow } from "./common";
import { add, cmp, sub } from "../decimal";
import { l1IsCurrent, effectiveL1Status } from "../diligence-rules";
import { rankLenders } from "../matching";
import { allocationBalances, headroomMap, lenderExposures } from "../exposure";
import { cycleLabel, nextCycleStart, normaliseCycleStart } from "../cycles";

/** The period's start month from the form (YYYY-MM, or a YYYY-MM-01 date), as YYYY-MM-01. */
export function parseCycleStart(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}(?:-01)?$/.test(s)) throw new ValidationError("Period start month must be YYYY-MM");
  try {
    return normaliseCycleStart(s);
  } catch {
    throw new ValidationError("Period start month must be YYYY-MM");
  }
}

export function spreadOf(borrowerRate: string | null | undefined, lenderRate: string | null | undefined): string | null {
  return borrowerRate != null && lenderRate != null ? sub(borrowerRate, lenderRate) : null;
}

export async function listRaises(actor: AdminActor) {
  return asAdmin(actor, async (tx) => {
    const rows = await tx
      .select({
        raise: raises,
        borrowerName: borrowers.name,
        borrowerRate: raiseEconomics.borrowerRate,
        securityLevel: securityLevels.name,
        instrument: instruments.name,
      })
      .from(raises)
      .innerJoin(borrowers, eq(borrowers.id, raises.borrowerId))
      .leftJoin(raiseEconomics, eq(raiseEconomics.raiseId, raises.id))
      .leftJoin(securityLevels, eq(securityLevels.id, raises.securityLevelId))
      .leftJoin(instruments, eq(instruments.id, raises.instrumentId))
      .orderBy(desc(raises.cycleStart), asc(borrowers.name));
    const shareCounts = await tx
      .select({ raiseId: dealShares.raiseId, n: sql<number>`count(*)::int` })
      .from(dealShares)
      .where(isNull(dealShares.revokedAt))
      .groupBy(dealShares.raiseId);
    const pending = await tx
      .select({ raiseId: approvals.raiseId, n: sql<number>`count(*)::int` })
      .from(approvals)
      .where(eq(approvals.status, "pending"))
      .groupBy(approvals.raiseId);
    return rows.map((r) => ({
      ...r,
      spread: spreadOf(r.borrowerRate, r.raise.lenderRate),
      shares: shareCounts.find((s) => s.raiseId === r.raise.id)?.n ?? 0,
      pendingApprovals: pending.find((p) => p.raiseId === r.raise.id)?.n ?? 0,
    }));
  });
}

export async function getRaise(actor: AdminActor, id: string) {
  const raiseId = uuidOrThrow(id);
  return asAdmin(actor, async (tx) => {
    const [r] = await tx.select().from(raises).where(eq(raises.id, raiseId));
    if (!r) throw new NotFoundError();
    const [b] = await tx.select().from(borrowers).where(eq(borrowers.id, r.borrowerId));
    const [l1] = await tx.select().from(diligenceL1).where(eq(diligenceL1.borrowerId, r.borrowerId));
    const [econ] = await tx.select().from(raiseEconomics).where(eq(raiseEconomics.raiseId, raiseId));
    const [inst] = r.instrumentId ? await tx.select().from(instruments).where(eq(instruments.id, r.instrumentId)) : [];
    const [seg] = r.segmentId ? await tx.select().from(segments).where(eq(segments.id, r.segmentId)) : [];
    const shares = await tx
      .select({ share: dealShares, lenderName: lenders.name })
      .from(dealShares)
      .innerJoin(lenders, eq(lenders.id, dealShares.lenderId))
      .where(eq(dealShares.raiseId, raiseId))
      .orderBy(asc(lenders.name));
    const allocs = await tx
      .select({ allocation: allocations, lenderName: lenders.name })
      .from(allocations)
      .innerJoin(lenders, eq(lenders.id, allocations.lenderId))
      .where(eq(allocations.raiseId, raiseId))
      .orderBy(asc(lenders.name));
    const balances = await allocationBalances(tx, { raiseId });
    const movements = await tx
      .select({ m: allocationMovements, lenderName: lenders.name, enteredByName: users.name })
      .from(allocationMovements)
      .innerJoin(lenders, eq(lenders.id, allocationMovements.lenderId))
      .leftJoin(users, eq(users.id, allocationMovements.enteredBy))
      .where(eq(allocationMovements.raiseId, raiseId))
      .orderBy(desc(allocationMovements.valueDate), desc(allocationMovements.createdAt));
    const raiseApprovals = await tx
      .select({ a: approvals, requestedByName: users.name })
      .from(approvals)
      .leftJoin(users, eq(users.id, approvals.requestedBy))
      .where(eq(approvals.raiseId, raiseId))
      .orderBy(desc(approvals.requestedAt));
    const matches = await matchesFor(tx, r);
    const termsHistory = await tx
      .select({ h: raiseTermsHistory, changedByName: users.name, securityLevel: securityLevels.name, instrument: instruments.name })
      .from(raiseTermsHistory)
      .leftJoin(users, eq(users.id, raiseTermsHistory.changedBy))
      .leftJoin(securityLevels, eq(securityLevels.id, raiseTermsHistory.securityLevelId))
      .leftJoin(instruments, eq(instruments.id, raiseTermsHistory.instrumentId))
      .where(eq(raiseTermsHistory.raiseId, raiseId))
      .orderBy(desc(raiseTermsHistory.version));
    const lenderNames = new Map((await tx.select({ id: lenders.id, name: lenders.name }).from(lenders)).map((l) => [l.id, l.name]));
    return {
      raise: r,
      instrument: inst?.name ?? null,
      segment: seg?.name ?? null,
      termsHistory,
      termsLocked: allocs.some((a) => ["sanctioned", "disbursed"].includes(a.allocation.status)),
      borrower: b,
      l1Status: effectiveL1Status(l1),
      l1Current: l1IsCurrent(l1),
      borrowerRate: econ?.borrowerRate ?? null,
      expectedRateMin: econ?.expectedRateMin ?? null,
      expectedRateMax: econ?.expectedRateMax ?? null,
      spread: spreadOf(econ?.borrowerRate, r.lenderRate),
      shares,
      allocations: allocs.map((a) => ({ ...a, balance: balances.find((x) => x.allocationId === a.allocation.id) ?? null })),
      movements,
      approvals: raiseApprovals.map((x) => ({
        ...x,
        lenderNames: ((x.a.payload as { lenderIds?: string[]; lenderId?: string }).lenderIds ??
          [(x.a.payload as { lenderId?: string }).lenderId].filter(Boolean)
        ).map((id) => lenderNames.get(id as string) ?? "—"),
      })),
      matches,
    };
  });
}

async function matchesFor(tx: Tx, r: typeof raises.$inferSelect) {
  const segs = (await tx.select().from(borrowerSegments).where(eq(borrowerSegments.borrowerId, r.borrowerId))).map((s) => s.segmentId);
  const ls = await tx.select().from(lenders);
  const targets = await tx.select().from(lenderSegmentTargets);
  const levels = await tx.select().from(lenderSecurityLevels);
  const insts = await tx.select().from(lenderInstruments);
  const exposure = await lenderExposures(tx, ls.map((l) => l.id));
  return rankLenders(
    {
      amount: r.amount,
      filledAmount: r.filledAmount,
      lenderRate: r.lenderRate,
      securityLevelId: r.securityLevelId,
      instrumentId: r.instrumentId,
      segmentId: r.segmentId,
      borrowerSegmentIds: segs,
    },
    ls.map((l) => ({
      ...l,
      segmentIds: targets.filter((t) => t.lenderId === l.id).map((t) => t.segmentId),
      securityLevelIds: levels.filter((t) => t.lenderId === l.id).map((t) => t.securityLevelId),
      instrumentIds: insts.filter((t) => t.lenderId === l.id).map((t) => t.instrumentId),
      headroom: headroomMap(exposure.get(l.id)),
    })),
  );
}

export type RaiseInput = {
  borrowerId?: unknown;
  /** Start month of the period. The cycle itself comes from the borrower. */
  cycleStart: unknown;
  amount: unknown;
  lenderRate?: unknown;
  borrowerRate?: unknown;
  expectedRateMin?: unknown;
  expectedRateMax?: unknown;
  instrumentId?: unknown;
  segmentId?: unknown;
  purpose?: unknown;
  securityLevelId?: unknown;
  securityDescription?: unknown;
  terms?: unknown;
};

function parseRaise(input: RaiseInput) {
  const lenderRate = optRate(input.lenderRate, "Lender rate");
  const borrowerRate = optRate(input.borrowerRate, "Borrower rate");
  const expectedRateMin = optRate(input.expectedRateMin, "Expected rate band (from)");
  const expectedRateMax = optRate(input.expectedRateMax, "Expected rate band (to)");
  if (lenderRate && borrowerRate && cmp(borrowerRate, lenderRate) < 0) {
    throw new ValidationError("Borrower rate is below the lender rate (negative spread)");
  }
  if (expectedRateMin && expectedRateMax && cmp(expectedRateMin, expectedRateMax) > 0) {
    throw new ValidationError("Expected rate band: 'from' is above 'to'");
  }
  return {
    raise: {
      cycleStart: parseCycleStart(input.cycleStart),
      amount: reqAmount(input.amount, "Amount requested"),
      lenderRate,
      instrumentId: input.instrumentId ? uuidOrThrow(input.instrumentId) : null,
      segmentId: input.segmentId ? uuidOrThrow(input.segmentId) : null,
      purpose: optText(input.purpose, 2000),
      securityLevelId: input.securityLevelId ? uuidOrThrow(input.securityLevelId) : null,
      securityDescription: optText(input.securityDescription, 2000),
      terms: optText(input.terms, 5000),
    },
    economics: { borrowerRate, expectedRateMin, expectedRateMax },
  };
}

/** Fields lenders see. A change to any of them is a new terms version. */
const LENDER_FACING = ["amount", "lenderRate", "instrumentId", "segmentId", "purpose", "securityLevelId", "securityDescription", "terms"] as const;
/** Fields that can no longer change once any lender's allocation is sanctioned or disbursed (everything but the amount). */
const LOCKED_AFTER_SANCTION = ["lenderRate", "instrumentId", "segmentId", "purpose", "securityLevelId", "securityDescription", "terms"] as const;

function sameValue(a: unknown, b: unknown) {
  if (a == null || b == null) return (a ?? null) === (b ?? null);
  const na = Number(a);
  const nb = Number(b);
  return typeof a === "string" && /^\d/.test(a) && !Number.isNaN(na) && !Number.isNaN(nb) ? na === nb : a === b;
}

async function recordTermsVersion(tx: Tx, raiseId: string, version: number, v: Record<string, unknown>, userId: string) {
  const s = (k: string) => (v[k] as string | null | undefined) ?? null;
  await tx.insert(raiseTermsHistory).values({
    raiseId,
    version,
    amount: v.amount as string,
    lenderRate: s("lenderRate"),
    instrumentId: s("instrumentId"),
    segmentId: s("segmentId"),
    purpose: s("purpose"),
    securityLevelId: s("securityLevelId"),
    securityDescription: s("securityDescription"),
    terms: s("terms"),
    changedBy: userId,
  });
}

export async function saveRaise(actor: AdminActor, id: string | null, input: RaiseInput): Promise<string> {
  const { raise: raiseValues, economics } = parseRaise(input);
  return asAdmin(actor, async (tx) => {
    let raiseId: string;
    let before: unknown = null;
    let cycle: (typeof raises.$inferSelect)["cycle"];
    if (id) {
      raiseId = uuidOrThrow(id);
      const [existing] = await tx.select().from(raises).where(eq(raises.id, raiseId));
      if (!existing) throw new NotFoundError();
      if (["closed", "cancelled"].includes(existing.status)) throw new ValidationError("This raise is closed");
      cycle = existing.cycle;
      if (cmp(raiseValues.amount, existing.filledAmount) < 0) throw new ValidationError("Amount cannot be below what is already filled");
      const changed = LENDER_FACING.filter((k) => !sameValue(existing[k], raiseValues[k]));
      if (changed.some((k) => (LOCKED_AFTER_SANCTION as readonly string[]).includes(k))) {
        const committed = await tx
          .select({ id: allocations.id })
          .from(allocations)
          .where(and(eq(allocations.raiseId, raiseId), inArray(allocations.status, ["sanctioned", "disbursed"])));
        if (committed.length) {
          throw new ValidationError("Terms are locked: an allocation on this raise is already sanctioned. Only the amount can change.");
        }
      }
      if (existing.cycleStart !== raiseValues.cycleStart && existing.status !== "draft") {
        throw new ValidationError("The period start can only change while the raise is a draft");
      }
      const [econ] = await tx.select().from(raiseEconomics).where(eq(raiseEconomics.raiseId, raiseId));
      before = { ...existing, ...(econ ?? {}) };
      const termsVersion = changed.length ? existing.termsVersion + 1 : existing.termsVersion;
      await tx.update(raises).set({ ...raiseValues, termsVersion, updatedAt: new Date() }).where(eq(raises.id, raiseId));
      if (changed.length) await recordTermsVersion(tx, raiseId, termsVersion, raiseValues, actor.userId);
    } else {
      const borrowerId = uuidOrThrow(input.borrowerId);
      const [b] = await tx.select({ id: borrowers.id, drawdownCycle: borrowers.drawdownCycle }).from(borrowers).where(eq(borrowers.id, borrowerId));
      if (!b) throw new NotFoundError();
      cycle = b.drawdownCycle;
      // Default the segment funded to the borrower's only segment, if it has exactly one.
      if (!raiseValues.segmentId) {
        const segs = await tx.select().from(borrowerSegments).where(eq(borrowerSegments.borrowerId, borrowerId));
        if (segs.length === 1) raiseValues.segmentId = segs[0].segmentId;
      }
      // The cycle is the borrower's at creation time, fixed on the raise so later borrower edits don't rewrite history.
      const [row] = await tx
        .insert(raises)
        .values({ ...raiseValues, borrowerId, cycle, createdBy: actor.userId })
        .returning({ id: raises.id });
      raiseId = row.id;
      await recordTermsVersion(tx, raiseId, 1, raiseValues, actor.userId);
    }
    await tx
      .insert(raiseEconomics)
      .values({ raiseId, ...economics })
      .onConflictDoUpdate({ target: raiseEconomics.raiseId, set: { ...economics, updatedAt: new Date() } });
    await logActivity(tx, actor, id ? "raise.updated" : "raise.created", "raise", raiseId, {
      before,
      after: { ...raiseValues, cycle, period: cycleLabel(raiseValues.cycleStart, cycle), ...economics },
    });
    return raiseId;
  });
}

/**
 * Recurring cycle: start the next period's raise for the same borrower from the previous one. The new raise starts
 * the day after the previous period ends and takes the borrower's current drawdown cycle.
 */
export async function repeatRaise(actor: AdminActor, previousId: string): Promise<string> {
  const prevId = uuidOrThrow(previousId);
  return asAdmin(actor, async (tx) => {
    const [p] = await tx.select().from(raises).where(eq(raises.id, prevId));
    if (!p) throw new NotFoundError();
    const [econ] = await tx.select().from(raiseEconomics).where(eq(raiseEconomics.raiseId, prevId));
    const [b] = await tx.select({ drawdownCycle: borrowers.drawdownCycle }).from(borrowers).where(eq(borrowers.id, p.borrowerId));
    const cycle = b?.drawdownCycle ?? p.cycle;
    const cycleStart = nextCycleStart(p.cycleStart, p.cycle);
    const carried = {
      amount: p.amount,
      lenderRate: p.lenderRate,
      instrumentId: p.instrumentId,
      segmentId: p.segmentId,
      purpose: p.purpose,
      securityLevelId: p.securityLevelId,
      securityDescription: p.securityDescription,
      terms: p.terms,
    };
    const [row] = await tx
      .insert(raises)
      .values({ borrowerId: p.borrowerId, cycleStart, cycle, ...carried, createdBy: actor.userId })
      .returning({ id: raises.id });
    await tx.insert(raiseEconomics).values({
      raiseId: row.id,
      borrowerRate: econ?.borrowerRate ?? null,
      expectedRateMin: econ?.expectedRateMin ?? null,
      expectedRateMax: econ?.expectedRateMax ?? null,
    });
    await recordTermsVersion(tx, row.id, 1, carried, actor.userId);
    await logActivity(tx, actor, "raise.repeated", "raise", row.id, { from: prevId, cycle, cycleStart, period: cycleLabel(cycleStart, cycle) });
    return row.id;
  });
}

const RAISE_STATUSES = ["draft", "open", "funded", "closed", "cancelled"] as const;

export async function setRaiseStatus(actor: AdminActor, raiseId: string, status: unknown) {
  const id = uuidOrThrow(raiseId);
  const s = String(status);
  if (!(RAISE_STATUSES as readonly string[]).includes(s)) throw new ValidationError("Invalid status");
  return asAdmin(actor, async (tx) => {
    const [r] = await tx.select().from(raises).where(eq(raises.id, id));
    if (!r) throw new NotFoundError();
    if (s === "open") {
      const [l1] = await tx.select().from(diligenceL1).where(eq(diligenceL1.borrowerId, r.borrowerId));
      if (!l1IsCurrent(l1)) throw new ValidationError("Level 1 diligence must be approved and within its quarterly refresh before opening");
      if (!r.lenderRate) throw new ValidationError("Set the lender rate before opening");
      if (!r.instrumentId) throw new ValidationError("Set the instrument before opening");
      if (!r.securityLevelId) throw new ValidationError("Set the security level before opening");
    }
    if (s === "funded" && cmp(r.filledAmount, r.amount) < 0) throw new ValidationError("Raise is not fully filled yet");
    if (s === "draft" && r.status !== "draft") {
      const active = await tx.select({ id: dealShares.id }).from(dealShares).where(and(eq(dealShares.raiseId, id), isNull(dealShares.revokedAt)));
      if (active.length) throw new ValidationError("Revoke lender shares before moving back to draft");
    }
    if (["closed", "cancelled", "draft"].includes(s)) {
      // Pending maker-checker requests can't outlive the state they were made in.
      await tx
        .update(approvals)
        .set({ status: "cancelled", decidedAt: new Date(), decisionNote: `Raise moved to ${s}` })
        .where(and(eq(approvals.raiseId, id), eq(approvals.status, "pending")));
    }
    const now = new Date();
    await tx
      .update(raises)
      .set({
        status: s as (typeof RAISE_STATUSES)[number],
        openedAt: s === "open" && !r.openedAt ? now : r.openedAt,
        closedAt: ["closed", "cancelled"].includes(s) ? now : null,
        updatedAt: now,
      })
      .where(eq(raises.id, id));
    await logActivity(tx, actor, "raise.status", "raise", id, { from: r.status, to: s });
  });
}

// ---------- Sharing and sanctioning (carried out only via an approved maker-checker request) ----------

export async function validateShare(tx: Tx, raiseId: string, lenderIds: string[]) {
  const [r] = await tx.select().from(raises).where(eq(raises.id, raiseId));
  if (!r) throw new NotFoundError();
  if (r.status !== "open") throw new ValidationError("Only open raises can be shared with lenders");
  if (!lenderIds.length) throw new ValidationError("Pick at least one lender");
  const found = await tx.select({ id: lenders.id }).from(lenders).where(inArray(lenders.id, lenderIds));
  if (found.length !== lenderIds.length) throw new NotFoundError();
  return r;
}

/** Internal: called by an approved share request. */
export async function executeShare(tx: Tx, actor: AdminActor, raiseId: string, lenderIds: string[], sharedBy: string) {
  await validateShare(tx, raiseId, lenderIds);
  for (const lenderId of lenderIds) {
    await tx
      .insert(dealShares)
      .values({ raiseId, lenderId, sharedBy })
      .onConflictDoUpdate({ target: [dealShares.raiseId, dealShares.lenderId], set: { revokedAt: null, sharedBy, sharedAt: new Date() } });
    await logActivity(tx, actor, "raise.shared", "raise", raiseId, { lenderId, requestedBy: sharedBy });
  }
}

export async function validateSanction(tx: Tx, raiseId: string, lenderId: string, amount: string) {
  const [r] = await tx.select().from(raises).where(eq(raises.id, raiseId));
  if (!r) throw new NotFoundError();
  if (!["open", "funded"].includes(r.status)) throw new ValidationError("Allocations can only change while the raise is open or funded");
  const [share] = await tx
    .select()
    .from(dealShares)
    .where(and(eq(dealShares.raiseId, raiseId), eq(dealShares.lenderId, lenderId), isNull(dealShares.revokedAt)));
  if (!share) throw new ValidationError("Share the raise with this lender first");
  const [existing] = await tx.select().from(allocations).where(and(eq(allocations.raiseId, raiseId), eq(allocations.lenderId, lenderId)));
  if (existing) {
    const [bal] = await allocationBalances(tx, { raiseId, lenderIds: [lenderId] });
    if (bal && cmp(amount, bal.disbursed) < 0) throw new ValidationError("Sanctioned amount can't be below what has already been disbursed");
  }
  const others = await tx
    .select({ amount: allocations.amount, lenderId: allocations.lenderId })
    .from(allocations)
    .where(and(eq(allocations.raiseId, raiseId), inArray(allocations.status, ["sanctioned", "disbursed"])));
  const filledByOthers = others.filter((o) => o.lenderId !== lenderId).reduce((a, o) => add(a, o.amount), "0.00");
  if (cmp(add(filledByOthers, amount), r.amount) > 0) throw new ValidationError("This would fill more than the raise amount");
  return { raise: r, existing: existing ?? null };
}

/** Internal: called by an approved sanction request. */
export async function executeSanction(tx: Tx, actor: AdminActor, raiseId: string, lenderId: string, amount: string, requestedBy: string) {
  const { existing } = await validateSanction(tx, raiseId, lenderId, amount);
  const status = existing?.status === "disbursed" ? "disbursed" : "sanctioned";
  const values = { amount, status: status as "sanctioned" | "disbursed", updatedBy: actor.userId, updatedAt: new Date() };
  await tx
    .insert(allocations)
    .values({ raiseId, lenderId, ...values })
    .onConflictDoUpdate({ target: [allocations.raiseId, allocations.lenderId], set: values });
  const filled = await recomputeFilled(tx, raiseId);
  await logActivity(tx, actor, "allocation.sanctioned", "raise", raiseId, { lenderId, amount, requestedBy, before: existing, filled });
}

export async function revokeShare(actor: AdminActor, raiseId: string, lenderId: string) {
  const id = uuidOrThrow(raiseId);
  const lId = uuidOrThrow(lenderId);
  return asAdmin(actor, async (tx) => {
    const res = await tx
      .update(dealShares)
      .set({ revokedAt: new Date() })
      .where(and(eq(dealShares.raiseId, id), eq(dealShares.lenderId, lId)))
      .returning({ id: dealShares.id });
    if (!res.length) throw new NotFoundError();
    await logActivity(tx, actor, "raise.share_revoked", "raise", id, { lenderId: lId });
  });
}

const DIRECT_STATUSES = ["interested", "declined", "withdrawn"] as const;

/**
 * Records a lender's indication or a decline/withdrawal directly. Sanctioning commits capital, so it goes through
 * a maker-checker request instead (approvals.requestSanction). Disbursement is recorded via recordMovement.
 */
export async function setAllocation(actor: AdminActor, raiseId: string, lenderId: string, amount: unknown, status: unknown) {
  const id = uuidOrThrow(raiseId);
  const lId = uuidOrThrow(lenderId);
  const amt = reqAmount(amount, "Allocation amount");
  const s = String(status);
  if (s === "sanctioned" || s === "disbursed") {
    throw new ValidationError("Sanctioning needs a second admin's approval: use 'Request sanction'. Disbursements are recorded as money movements.");
  }
  if (!(DIRECT_STATUSES as readonly string[]).includes(s)) throw new ValidationError("Invalid status");
  return asAdmin(actor, async (tx) => {
    const [r] = await tx.select().from(raises).where(eq(raises.id, id));
    if (!r) throw new NotFoundError();
    if (!["open", "funded"].includes(r.status)) throw new ValidationError("Allocations can only change while the raise is open or funded");
    const [share] = await tx
      .select()
      .from(dealShares)
      .where(and(eq(dealShares.raiseId, id), eq(dealShares.lenderId, lId), isNull(dealShares.revokedAt)));
    if (!share) throw new ValidationError("Share the raise with this lender first");
    const [prev] = await tx.select().from(allocations).where(and(eq(allocations.raiseId, id), eq(allocations.lenderId, lId)));
    if (prev) {
      const [bal] = await allocationBalances(tx, { raiseId: id, lenderIds: [lId] });
      if (bal && cmp(bal.disbursed, "0") > 0) throw new ValidationError("Money has moved on this allocation; record repayments instead of changing it");
      if (["sanctioned", "disbursed"].includes(prev.status) && s === "interested") {
        throw new ValidationError("A sanctioned allocation can be declined or withdrawn, not moved back to interested");
      }
    }
    const values = { amount: amt, status: s as (typeof DIRECT_STATUSES)[number], updatedBy: actor.userId, updatedAt: new Date() };
    await tx
      .insert(allocations)
      .values({ raiseId: id, lenderId: lId, ...values })
      .onConflictDoUpdate({ target: [allocations.raiseId, allocations.lenderId], set: values });
    const filled = await recomputeFilled(tx, id);
    await logActivity(tx, actor, "allocation.set", "raise", id, { lenderId: lId, before: prev ?? null, after: { amount: amt, status: s }, filled });
  });
}

async function recomputeFilled(tx: Tx, raiseId: string): Promise<string> {
  const rows = await tx
    .select({ amount: allocations.amount })
    .from(allocations)
    .where(and(eq(allocations.raiseId, raiseId), inArray(allocations.status, ["sanctioned", "disbursed"])));
  const filled = rows.reduce((acc, r) => add(acc, r.amount), "0.00");
  await tx.update(raises).set({ filledAmount: filled, updatedAt: new Date() }).where(eq(raises.id, raiseId));
  return filled;
}

// ---------- Money movements: disbursements and repayments ----------

function parseValueDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new ValidationError("Enter the value date");
  const today = new Date().toISOString().slice(0, 10);
  if (s > today) throw new ValidationError("The value date can't be in the future");
  return s;
}

export async function recordMovement(
  actor: AdminActor,
  raiseId: string,
  lenderId: string,
  kind: unknown,
  amount: unknown,
  valueDate: unknown,
  note: unknown,
) {
  const id = uuidOrThrow(raiseId);
  const lId = uuidOrThrow(lenderId);
  const k = String(kind);
  if (!["disbursement", "repayment"].includes(k)) throw new ValidationError("Choose disbursement or repayment");
  const amt = reqAmount(amount, "Amount");
  const date = parseValueDate(valueDate);
  return asAdmin(actor, async (tx) => {
    const [a] = await tx.select().from(allocations).where(and(eq(allocations.raiseId, id), eq(allocations.lenderId, lId)));
    if (!a) throw new NotFoundError();
    const [bal] = await allocationBalances(tx, { raiseId: id, lenderIds: [lId] });
    const disbursed = bal?.disbursed ?? "0.00";
    const outstanding = bal?.outstanding ?? "0.00";
    if (k === "disbursement") {
      if (!["sanctioned", "disbursed"].includes(a.status)) throw new ValidationError("Only a sanctioned allocation can be disbursed");
      if (cmp(add(disbursed, amt), a.amount) > 0) throw new ValidationError("Total disbursed would exceed the sanctioned amount");
    } else if (cmp(amt, outstanding) > 0) {
      throw new ValidationError("Repayment is more than the amount outstanding");
    }
    await tx.insert(allocationMovements).values({
      allocationId: a.id,
      raiseId: id,
      lenderId: lId,
      kind: k,
      amount: amt,
      valueDate: date,
      note: optText(note, 1000),
      enteredBy: actor.userId,
    });
    if (k === "disbursement" && a.status !== "disbursed") {
      await tx.update(allocations).set({ status: "disbursed", updatedBy: actor.userId, updatedAt: new Date() }).where(eq(allocations.id, a.id));
    }
    await logActivity(tx, actor, `movement.${k}`, "raise", id, { lenderId: lId, amount: amt, valueDate: date });
  });
}
