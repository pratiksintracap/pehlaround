import "server-only";
import { and, eq } from "drizzle-orm";
import { allocations, lenders } from "@/lib/credit/schema";
import type { Actor } from "./actors";
import { NotFoundError, ValidationError } from "./actors";
import { getRaise } from "./admin/raises";
import { asAdmin } from "./admin/common";
import { getDeal } from "./lender/deals";
import { logActivity } from "./activity";
import { withContext } from "@/lib/credit/db";
import { dbCtx } from "./actors";
import type { DraftRaise } from "./drafts";

/*
 * Loads draft data through the same permission paths as the screens: admins via the admin service, lenders via
 * getDeal (their own shared raises only, lender-safe fields only). So a lender can never draft a document for a
 * raise they can't see, and the borrower rate can't reach a draft.
 */

export async function draftRaiseFor(actor: Actor, raiseId: string): Promise<DraftRaise> {
  if (actor.kind === "admin") {
    const d = await getRaise(actor, raiseId);
    return {
      borrower: d.borrower,
      cycleStart: d.raise.cycleStart,
      cycle: d.raise.cycle,
      amount: d.raise.amount,
      filledAmount: d.raise.filledAmount,
      lenderRate: d.raise.lenderRate,
      instrument: d.instrument,
      segmentFunded: d.segment,
      purpose: d.raise.purpose,
      securityLevel: d.termsHistory[0]?.securityLevel ?? null,
      securityDescription: d.raise.securityDescription,
      terms: d.raise.terms,
      termsVersion: d.raise.termsVersion,
    };
  }
  if (actor.kind !== "lender") throw new NotFoundError();
  const d = await getDeal(actor, raiseId);
  return {
    borrower: d.borrower,
    cycleStart: d.raise.cycleStart,
    cycle: d.raise.cycle,
    amount: d.raise.amount,
    filledAmount: d.raise.filledAmount,
    lenderRate: d.raise.lenderRate,
    instrument: d.raise.instrument,
    segmentFunded: d.raise.segmentFunded,
    purpose: d.raise.purpose,
    securityLevel: d.raise.securityLevel,
    securityDescription: d.raise.securityDescription,
    terms: d.raise.terms,
    termsVersion: d.raise.termsVersion,
  };
}

/** Sanctioned lender + amount for a sanction letter. Lenders always get their own; admins name the lender. */
export async function sanctionFor(actor: Actor, raiseId: string, lenderIdForAdmin: string | null) {
  if (actor.kind === "partner" || actor.kind === "applicant_user") throw new NotFoundError();
  const lenderId = actor.kind === "admin" ? lenderIdForAdmin : actor.lenderId;
  if (!lenderId || !/^[0-9a-f-]{36}$/i.test(lenderId)) throw new NotFoundError();
  const load = async (tx: Parameters<Parameters<typeof asAdmin>[1]>[0]) => {
    const [row] = await tx
      .select({ amount: allocations.amount, status: allocations.status, name: lenders.name })
      .from(allocations)
      .innerJoin(lenders, eq(lenders.id, allocations.lenderId))
      .where(and(eq(allocations.raiseId, raiseId), eq(allocations.lenderId, lenderId)));
    if (!row) throw new NotFoundError();
    if (!["sanctioned", "disbursed"].includes(row.status)) throw new ValidationError("Not sanctioned yet");
    await logActivity(tx, actor, "draft.sanction_letter", "raise", raiseId, { lenderId });
    return { name: row.name, amount: row.amount };
  };
  return actor.kind === "admin" ? asAdmin(actor, load) : withContext(dbCtx(actor), load);
}

export async function logTermSheet(actor: Actor, raiseId: string) {
  await withContext(dbCtx(actor), (tx) => logActivity(tx, actor, "draft.term_sheet", "raise", raiseId));
}
