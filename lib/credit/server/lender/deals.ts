import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { withContext, type Tx } from "@/lib/credit/db";
import {
  allocations,
  borrowers,
  borrowerSegments,
  dealMessages,
  dealShares,
  diligenceL1History,
  raiseTermsHistory,
  borrowerFinancials,
  instruments,
  lenderInstruments,
  allocationMovements,
  diligenceItems,
  diligenceL1,
  documents,
  lenderReviews,
  lenders,
  lenderSecurityLevels,
  lenderSegmentTargets,
  raises,
  securityLevels,
  segments,
  users,
} from "@/lib/credit/schema";
import { type LenderActor, ForbiddenError, NotFoundError, ValidationError, dbCtx } from "../actors";
import { logActivity } from "../activity";
import { AMOUNT_RE, cmp } from "../decimal";
import { effectiveL1Status } from "../diligence-rules";
import { matchLender } from "../matching";
import { notifyAdminsOfLenderMessage } from "../notify";
import { allocationBalances, headroomMap, lenderExposures } from "../exposure";
import { financialsBehind } from "../admin/financials-rules";

/*
 * Everything a lender can read goes through this module. Two locks on every query:
 *  1. App layer: every query is joined to deal_shares filtered by the actor's own lenderId (never a client value).
 *  2. Database: the lender RLS context (see sql/rls.sql) hides any row outside those shares regardless.
 * Return shapes list fields explicitly: no borrower rate, no spread, no internal notes, no other lender.
 */

function asLender<T>(actor: LenderActor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!actor || actor.kind !== "lender" || !actor.lenderId) throw new ForbiddenError();
  return withContext(dbCtx(actor), fn);
}

function requireLenderAdmin(actor: LenderActor) {
  if (actor.role !== "lender_admin") throw new ForbiddenError("Your account can view but not act");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function idOrNotFound(v: unknown): string {
  const s = String(v ?? "");
  if (!UUID_RE.test(s)) throw new NotFoundError();
  return s;
}

/** Raise IDs actively shared with this lender (app-layer scope). */
function sharedRaiseFilter(actor: LenderActor) {
  return and(eq(dealShares.lenderId, actor.lenderId), isNull(dealShares.revokedAt), ne(raises.status, "draft"));
}

async function ownThesis(tx: Tx, lenderId: string) {
  const [l] = await tx.select().from(lenders).where(eq(lenders.id, lenderId));
  if (!l) throw new NotFoundError();
  const segIds = (await tx.select().from(lenderSegmentTargets).where(eq(lenderSegmentTargets.lenderId, lenderId))).map((t) => t.segmentId);
  const levelIds = (await tx.select().from(lenderSecurityLevels).where(eq(lenderSecurityLevels.lenderId, lenderId))).map((t) => t.securityLevelId);
  const instrumentIds = (await tx.select().from(lenderInstruments).where(eq(lenderInstruments.lenderId, lenderId))).map((t) => t.instrumentId);
  const exposure = (await lenderExposures(tx, [lenderId])).get(lenderId);
  return { ...l, segmentIds: segIds, securityLevelIds: levelIds, instrumentIds, headroom: headroomMap(exposure) };
}

export type LenderDealSummary = {
  raiseId: string;
  borrowerName: string;
  cycleStart: string;
  cycle: string;
  status: string;
  amount: string;
  filledAmount: string;
  lenderRate: string | null;
  securityLevel: string | null;
  instrument: string | null;
  segments: string[];
  myAllocation: { amount: string; status: string; onOlderTerms: boolean } | null;
  myLevel2: string;
  fit: { thesis: string; instrument: string; rateBand: string; riskAppetite: string; ticket: string; isMatch: boolean; targetReached: boolean };
};

export async function getDealFlow(actor: LenderActor): Promise<LenderDealSummary[]> {
  return asLender(actor, async (tx) => {
    const rows = await tx
      .select({
        raiseId: raises.id,
        borrowerId: raises.borrowerId,
        borrowerName: borrowers.name,
        cycleStart: raises.cycleStart,
        cycle: raises.cycle,
        status: raises.status,
        amount: raises.amount,
        filledAmount: raises.filledAmount,
        lenderRate: raises.lenderRate,
        securityLevelId: raises.securityLevelId,
        securityLevel: securityLevels.name,
        termsVersion: raises.termsVersion,
        instrumentId: raises.instrumentId,
        instrument: instruments.name,
        segmentId: raises.segmentId,
      })
      .from(dealShares)
      .innerJoin(raises, eq(raises.id, dealShares.raiseId))
      .leftJoin(instruments, eq(instruments.id, raises.instrumentId))
      .innerJoin(borrowers, eq(borrowers.id, raises.borrowerId))
      .leftJoin(securityLevels, eq(securityLevels.id, raises.securityLevelId))
      .where(sharedRaiseFilter(actor))
      .orderBy(desc(raises.cycleStart), asc(borrowers.name));
    if (!rows.length) return [];
    const borrowerIds = [...new Set(rows.map((r) => r.borrowerId))];
    const segs = await tx
      .select({ borrowerId: borrowerSegments.borrowerId, segmentId: segments.id, name: segments.name })
      .from(borrowerSegments)
      .innerJoin(segments, eq(segments.id, borrowerSegments.segmentId))
      .where(inArray(borrowerSegments.borrowerId, borrowerIds));
    const myAllocs = await tx
      .select({ raiseId: allocations.raiseId, amount: allocations.amount, status: allocations.status, termsVersion: allocations.termsVersion })
      .from(allocations)
      .where(and(eq(allocations.lenderId, actor.lenderId), inArray(allocations.raiseId, rows.map((r) => r.raiseId))));
    const myReviews = await tx
      .select({ borrowerId: lenderReviews.borrowerId, status: lenderReviews.status })
      .from(lenderReviews)
      .where(and(eq(lenderReviews.lenderId, actor.lenderId), inArray(lenderReviews.borrowerId, borrowerIds)));
    const thesis = await ownThesis(tx, actor.lenderId);
    return rows.map((r) => {
      const bSegs = segs.filter((s) => s.borrowerId === r.borrowerId);
      const m = matchLender(
        {
          amount: r.amount,
          filledAmount: r.filledAmount,
          lenderRate: r.lenderRate,
          securityLevelId: r.securityLevelId,
          instrumentId: r.instrumentId,
          segmentId: r.segmentId,
          borrowerSegmentIds: bSegs.map((s) => s.segmentId),
        },
        thesis,
      );
      const a = myAllocs.find((x) => x.raiseId === r.raiseId);
      return {
        raiseId: r.raiseId,
        borrowerName: r.borrowerName,
        cycleStart: r.cycleStart,
        cycle: r.cycle,
        status: r.status,
        amount: r.amount,
        filledAmount: r.filledAmount,
        lenderRate: r.lenderRate,
        securityLevel: r.securityLevel,
        instrument: r.instrument,
        segments: bSegs.map((s) => s.name),
        myAllocation: a ? { amount: a.amount, status: a.status, onOlderTerms: a.termsVersion != null && a.termsVersion < r.termsVersion } : null,
        myLevel2: myReviews.find((x) => x.borrowerId === r.borrowerId)?.status ?? "not_started",
        fit: { thesis: m.thesis, instrument: m.instrument, rateBand: m.rateBand, riskAppetite: m.riskAppetite, ticket: m.ticket, isMatch: m.isMatch, targetReached: m.targetReached },
      };
    });
  });
}

export async function getDeal(actor: LenderActor, raiseIdRaw: string) {
  const raiseId = idOrNotFound(raiseIdRaw);
  return asLender(actor, async (tx) => {
    const [row] = await tx
      .select({
        raiseId: raises.id,
        borrowerId: raises.borrowerId,
        cycleStart: raises.cycleStart,
        cycle: raises.cycle,
        status: raises.status,
        amount: raises.amount,
        filledAmount: raises.filledAmount,
        lenderRate: raises.lenderRate,
        securityLevel: securityLevels.name,
        securityDescription: raises.securityDescription,
        terms: raises.terms,
        termsVersion: raises.termsVersion,
        instrument: instruments.name,
        segmentFunded: segments.name,
        purpose: raises.purpose,
      })
      .from(dealShares)
      .innerJoin(raises, eq(raises.id, dealShares.raiseId))
      .leftJoin(securityLevels, eq(securityLevels.id, raises.securityLevelId))
      .leftJoin(instruments, eq(instruments.id, raises.instrumentId))
      .leftJoin(segments, eq(segments.id, raises.segmentId))
      .where(and(eq(dealShares.raiseId, raiseId), sharedRaiseFilter(actor)));
    if (!row) throw new NotFoundError();

    const [b] = await tx
      .select({ id: borrowers.id, name: borrowers.name, cin: borrowers.cin, rbiRegistration: borrowers.rbiRegistration, city: borrowers.city, state: borrowers.state })
      .from(borrowers)
      .where(eq(borrowers.id, row.borrowerId));
    if (!b) throw new NotFoundError();
    const segs = await tx
      .select({ name: segments.name })
      .from(borrowerSegments)
      .innerJoin(segments, eq(segments.id, borrowerSegments.segmentId))
      .where(eq(borrowerSegments.borrowerId, b.id));
    const [l1] = await tx
      .select({ status: diligenceL1.status, refreshDueAt: diligenceL1.refreshDueAt, approvedAt: diligenceL1.approvedAt })
      .from(diligenceL1)
      .where(eq(diligenceL1.borrowerId, b.id));
    const items = await tx
      .select({ id: diligenceItems.id, title: diligenceItems.title, description: diligenceItems.description, status: diligenceItems.status })
      .from(diligenceItems)
      .where(eq(diligenceItems.borrowerId, b.id))
      .orderBy(asc(diligenceItems.sort));
    const docs = await tx
      .select({ id: documents.id, itemId: documents.diligenceItemId, filename: documents.filename, sizeBytes: documents.sizeBytes, createdAt: documents.createdAt, supersededAt: documents.supersededAt })
      .from(documents)
      .where(eq(documents.borrowerId, b.id))
      .orderBy(desc(documents.createdAt));
    const [myReview] = await tx
      .select({ status: lenderReviews.status, notes: lenderReviews.notes, updatedAt: lenderReviews.updatedAt })
      .from(lenderReviews)
      .where(and(eq(lenderReviews.lenderId, actor.lenderId), eq(lenderReviews.borrowerId, b.id)));
    const [myAlloc] = await tx
      .select({ amount: allocations.amount, status: allocations.status, updatedAt: allocations.updatedAt, termsVersion: allocations.termsVersion })
      .from(allocations)
      .where(and(eq(allocations.lenderId, actor.lenderId), eq(allocations.raiseId, raiseId)));
    const termsHistory = await tx
      .select({
        version: raiseTermsHistory.version,
        amount: raiseTermsHistory.amount,
        lenderRate: raiseTermsHistory.lenderRate,
        securityLevel: securityLevels.name,
        securityDescription: raiseTermsHistory.securityDescription,
        terms: raiseTermsHistory.terms,
        instrument: instruments.name,
        purpose: raiseTermsHistory.purpose,
        changedAt: raiseTermsHistory.changedAt,
      })
      .from(raiseTermsHistory)
      .leftJoin(securityLevels, eq(securityLevels.id, raiseTermsHistory.securityLevelId))
      .leftJoin(instruments, eq(instruments.id, raiseTermsHistory.instrumentId))
      .where(eq(raiseTermsHistory.raiseId, raiseId))
      .orderBy(desc(raiseTermsHistory.version));
    const l1History = await tx
      .select({ status: diligenceL1History.status, decidedAt: diligenceL1History.decidedAt })
      .from(diligenceL1History)
      .where(eq(diligenceL1History.borrowerId, b.id))
      .orderBy(desc(diligenceL1History.decidedAt));
    const thread = await tx
      .select({ id: dealMessages.id, authorSide: dealMessages.authorSide, body: dealMessages.body, createdAt: dealMessages.createdAt, authorName: users.name })
      .from(dealMessages)
      .leftJoin(users, eq(users.id, dealMessages.authorUserId))
      .where(and(eq(dealMessages.raiseId, raiseId), eq(dealMessages.lenderId, actor.lenderId)))
      .orderBy(asc(dealMessages.createdAt));

    const financials = await tx
      .select({ periodEnd: borrowerFinancials.periodEnd, aum: borrowerFinancials.aum, gnpaPct: borrowerFinancials.gnpaPct, leverage: borrowerFinancials.leverage })
      .from(borrowerFinancials)
      .where(eq(borrowerFinancials.borrowerId, b.id))
      .orderBy(desc(borrowerFinancials.periodEnd))
      .limit(8);
    const [balance] = await allocationBalances(tx, { raiseId, lenderIds: [actor.lenderId] });
    const myMovements = await tx
      .select({ kind: allocationMovements.kind, amount: allocationMovements.amount, valueDate: allocationMovements.valueDate })
      .from(allocationMovements)
      .where(and(eq(allocationMovements.raiseId, raiseId), eq(allocationMovements.lenderId, actor.lenderId)))
      .orderBy(desc(allocationMovements.valueDate));

    const { borrowerId: _b, ...raise } = row;
    void _b;
    return {
      raise,
      borrower: { ...b, segments: segs.map((s) => s.name) },
      level1: { status: effectiveL1Status(l1 ? { status: l1.status, refreshDueAt: l1.refreshDueAt } : null), approvedAt: l1?.approvedAt ?? null, refreshDueAt: l1?.refreshDueAt ?? null },
      items,
      documents: docs,
      myLevel2: myReview ?? { status: "not_started", notes: null, updatedAt: null },
      myAllocation: myAlloc ? { ...myAlloc, onOlderTerms: myAlloc.termsVersion != null && myAlloc.termsVersion < row.termsVersion } : null,
      // Platform-team names are shown; lender-side names are only ever this lender's own colleagues.
      thread: thread.map((m) => ({ ...m, authorName: m.authorSide === "platform" ? "Platform team" : m.authorName })),
      termsHistory,
      level1History: l1History,
      financials,
      financialsBehind: financialsBehind(financials[0]?.periodEnd),
      myBalance: balance ? { disbursed: balance.disbursed, outstanding: balance.outstanding } : null,
      myMovements,
      sanctionLetterAvailable: !!myAlloc && ["sanctioned", "disbursed"].includes(myAlloc.status),
    };
  });
}

/** Returns document metadata only if the document belongs to a borrower in one of this lender's active shares. */
export async function getDocumentForLender(actor: LenderActor, docIdRaw: string) {
  const docId = idOrNotFound(docIdRaw);
  return asLender(actor, async (tx) => {
    const [doc] = await tx
      .select({ id: documents.id, filename: documents.filename, contentType: documents.contentType, storageKey: documents.storageKey, borrowerId: documents.borrowerId })
      .from(documents)
      .where(eq(documents.id, docId));
    if (!doc) throw new NotFoundError();
    const [share] = await tx
      .select({ id: dealShares.id })
      .from(dealShares)
      .innerJoin(raises, eq(raises.id, dealShares.raiseId))
      .where(and(eq(raises.borrowerId, doc.borrowerId), sharedRaiseFilter(actor)))
      .limit(1);
    if (!share) throw new NotFoundError();
    await logActivity(tx, actor, "document.viewed", "document", doc.id, { filename: doc.filename });
    return doc;
  });
}

const L2_STATUSES = ["not_started", "in_review", "approved", "rejected"] as const;

/** Level 2: the lender records its own diligence status on a borrower in its funnel. Lender admins only. */
export async function setMyLevel2(actor: LenderActor, raiseIdRaw: string, status: unknown, notes: unknown) {
  requireLenderAdmin(actor);
  const raiseId = idOrNotFound(raiseIdRaw);
  const s = String(status);
  if (!(L2_STATUSES as readonly string[]).includes(s)) throw new ValidationError("Invalid status");
  const n = String(notes ?? "").trim().slice(0, 5000) || null;
  return asLender(actor, async (tx) => {
    const [row] = await tx
      .select({ borrowerId: raises.borrowerId })
      .from(dealShares)
      .innerJoin(raises, eq(raises.id, dealShares.raiseId))
      .where(and(eq(dealShares.raiseId, raiseId), sharedRaiseFilter(actor)));
    if (!row) throw new NotFoundError();
    const values = { status: s as (typeof L2_STATUSES)[number], notes: n, updatedBy: actor.userId, updatedAt: new Date() };
    await tx
      .insert(lenderReviews)
      .values({ lenderId: actor.lenderId, borrowerId: row.borrowerId, ...values })
      .onConflictDoUpdate({ target: [lenderReviews.lenderId, lenderReviews.borrowerId], set: values });
    await logActivity(tx, actor, "diligence_l2.status", "borrower", row.borrowerId, { raiseId, to: s });
  });
}

/** Lender indicates interest in an amount on an open raise. The platform team then sanctions it. */
export async function expressInterest(actor: LenderActor, raiseIdRaw: string, amountRaw: unknown) {
  requireLenderAdmin(actor);
  const raiseId = idOrNotFound(raiseIdRaw);
  const amount = String(amountRaw ?? "").replace(/,/g, "").trim();
  if (!AMOUNT_RE.test(amount) || Number(amount) <= 0) throw new ValidationError("Enter an amount in rupees");
  return asLender(actor, async (tx) => {
    const [r] = await tx
      .select({ id: raises.id, status: raises.status, amount: raises.amount, filledAmount: raises.filledAmount, termsVersion: raises.termsVersion })
      .from(dealShares)
      .innerJoin(raises, eq(raises.id, dealShares.raiseId))
      .where(and(eq(dealShares.raiseId, raiseId), sharedRaiseFilter(actor)));
    if (!r) throw new NotFoundError();
    if (r.status !== "open") throw new ValidationError("This raise is not open");
    if (cmp(amount, r.amount) > 0) throw new ValidationError("Amount is above the raise size");
    const [existing] = await tx.select().from(allocations).where(and(eq(allocations.raiseId, raiseId), eq(allocations.lenderId, actor.lenderId)));
    if (existing && !["interested", "withdrawn"].includes(existing.status)) {
      throw new ValidationError("Your allocation is already being processed; contact the platform team to change it");
    }
    const values = { amount, status: "interested" as const, termsVersion: r.termsVersion, updatedBy: actor.userId, updatedAt: new Date() };
    if (existing) await tx.update(allocations).set(values).where(eq(allocations.id, existing.id));
    else await tx.insert(allocations).values({ raiseId, lenderId: actor.lenderId, ...values });
    await logActivity(tx, actor, "allocation.interest", "raise", raiseId, { amount, termsVersion: r.termsVersion });
  });
}

export async function withdrawInterest(actor: LenderActor, raiseIdRaw: string) {
  requireLenderAdmin(actor);
  const raiseId = idOrNotFound(raiseIdRaw);
  return asLender(actor, async (tx) => {
    const [existing] = await tx
      .select()
      .from(allocations)
      .innerJoin(dealShares, and(eq(dealShares.raiseId, allocations.raiseId), eq(dealShares.lenderId, allocations.lenderId)))
      .innerJoin(raises, eq(raises.id, allocations.raiseId))
      .where(and(eq(allocations.raiseId, raiseId), eq(allocations.lenderId, actor.lenderId), sharedRaiseFilter(actor)));
    if (!existing) throw new NotFoundError();
    if (existing.credit_allocations.status !== "interested") throw new ValidationError("Only an interest indication can be withdrawn here");
    await tx.update(allocations).set({ status: "withdrawn", updatedBy: actor.userId, updatedAt: new Date() }).where(eq(allocations.id, existing.credit_allocations.id));
    await logActivity(tx, actor, "allocation.withdrawn", "raise", raiseId);
  });
}

export async function getMyProfile(actor: LenderActor) {
  return asLender(actor, async (tx) => {
    const [l] = await tx
      .select({ id: lenders.id, name: lenders.name, minTicket: lenders.minTicket, maxTicket: lenders.maxTicket, minRate: lenders.minRate, maxRate: lenders.maxRate, thesisNotes: lenders.thesisNotes })
      .from(lenders)
      .where(eq(lenders.id, actor.lenderId));
    if (!l) throw new NotFoundError();
    const targets = await tx
      .select({ name: segments.name, targetExposure: lenderSegmentTargets.targetExposure })
      .from(lenderSegmentTargets)
      .innerJoin(segments, eq(segments.id, lenderSegmentTargets.segmentId))
      .where(eq(lenderSegmentTargets.lenderId, actor.lenderId));
    const levels = await tx
      .select({ name: securityLevels.name })
      .from(lenderSecurityLevels)
      .innerJoin(securityLevels, eq(securityLevels.id, lenderSecurityLevels.securityLevelId))
      .where(eq(lenderSecurityLevels.lenderId, actor.lenderId));
    const team = await tx
      .select({ name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.lenderId, actor.lenderId), isNull(users.disabledAt)))
      .orderBy(asc(users.name));
    const insts = await tx
      .select({ name: instruments.name })
      .from(lenderInstruments)
      .innerJoin(instruments, eq(instruments.id, lenderInstruments.instrumentId))
      .where(eq(lenderInstruments.lenderId, actor.lenderId));
    const exposure = (await lenderExposures(tx, [actor.lenderId])).get(actor.lenderId)!;
    return { lender: l, targets, securityLevels: levels.map((x) => x.name), instruments: insts.map((x) => x.name), team, exposure };
  });
}

/** Lender admins ask the platform team a question on a raise in their funnel. The thread is private to this lender. */
export async function postMyMessage(actor: LenderActor, raiseIdRaw: string, bodyRaw: unknown) {
  requireLenderAdmin(actor);
  const raiseId = idOrNotFound(raiseIdRaw);
  const body = String(bodyRaw ?? "").trim();
  if (!body) throw new ValidationError("Write a message first");
  if (body.length > 5000) throw new ValidationError("Message is too long");
  await asLender(actor, async (tx) => {
    const [row] = await tx
      .select({ id: raises.id })
      .from(dealShares)
      .innerJoin(raises, eq(raises.id, dealShares.raiseId))
      .where(and(eq(dealShares.raiseId, raiseId), sharedRaiseFilter(actor)));
    if (!row) throw new NotFoundError();
    await tx.insert(dealMessages).values({ raiseId, lenderId: actor.lenderId, authorUserId: actor.userId, authorSide: "lender", body });
    await logActivity(tx, actor, "message.lender", "raise", raiseId);
  });
  await notifyAdminsOfLenderMessage(raiseId);
}
