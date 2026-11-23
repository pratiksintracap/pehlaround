import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { approvals, borrowers, raises, users } from "@/lib/credit/schema";
import { type AdminActor, ForbiddenError, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optText, reqAmount, uuidOrThrow } from "./common";
import { executeSanction, executeShare, validateSanction, validateShare } from "./raises";
import { notifyLenderOfShare } from "../notify";

/*
 * Maker-checker. Sharing a raise with lenders and sanctioning an allocation are requested by one platform admin
 * and carried out only when a different admin approves. Checks run again at approval time, because the raise may
 * have changed since the request. The database also refuses an approval decided by the requester.
 */

type SharePayload = { lenderIds: string[] };
type SanctionPayload = { lenderId: string; amount: string };

export async function requestShare(actor: AdminActor, raiseId: string, lenderIds: string[]) {
  const id = uuidOrThrow(raiseId);
  const ids = [...new Set(lenderIds.map(uuidOrThrow))];
  return asAdmin(actor, async (tx) => {
    await validateShare(tx, id, ids);
    const payload: SharePayload = { lenderIds: ids };
    const [row] = await tx.insert(approvals).values({ kind: "share", raiseId: id, payload, requestedBy: actor.userId }).returning({ id: approvals.id });
    await logActivity(tx, actor, "approval.requested", "raise", id, { approvalId: row.id, kind: "share", lenderIds: ids });
    return row.id;
  });
}

export async function requestSanction(actor: AdminActor, raiseId: string, lenderId: string, amount: unknown) {
  const id = uuidOrThrow(raiseId);
  const lId = uuidOrThrow(lenderId);
  const amt = reqAmount(amount, "Sanction amount");
  return asAdmin(actor, async (tx) => {
    await validateSanction(tx, id, lId, amt);
    const payload: SanctionPayload = { lenderId: lId, amount: amt };
    const [row] = await tx.insert(approvals).values({ kind: "sanction", raiseId: id, payload, requestedBy: actor.userId }).returning({ id: approvals.id });
    await logActivity(tx, actor, "approval.requested", "raise", id, { approvalId: row.id, kind: "sanction", lenderId: lId, amount: amt });
    return row.id;
  });
}

export async function approve(actor: AdminActor, approvalId: string, note?: unknown) {
  const id = uuidOrThrow(approvalId);
  const shared = await asAdmin(actor, async (tx) => {
    // Lock the row so two admins can't approve the same request at once.
    const [a] = await tx.select().from(approvals).where(eq(approvals.id, id)).for("update");
    if (!a) throw new NotFoundError();
    if (a.status !== "pending") throw new ValidationError("This request has already been decided");
    if (a.requestedBy === actor.userId) throw new ForbiddenError("You can't approve your own request");
    if (a.kind === "share") {
      const p = a.payload as SharePayload;
      await executeShare(tx, actor, a.raiseId, p.lenderIds, a.requestedBy);
    } else {
      const p = a.payload as SanctionPayload;
      await executeSanction(tx, actor, a.raiseId, p.lenderId, p.amount, a.requestedBy);
    }
    await tx
      .update(approvals)
      .set({ status: "approved", decidedBy: actor.userId, decidedAt: new Date(), decisionNote: optText(note, 1000) })
      .where(eq(approvals.id, id));
    await logActivity(tx, actor, "approval.approved", "raise", a.raiseId, { approvalId: id, kind: a.kind, requestedBy: a.requestedBy });
    return a.kind === "share" ? (a.payload as SharePayload).lenderIds : [];
  });
  for (const lenderId of shared) await notifyLenderOfShare(lenderId);
}

export async function reject(actor: AdminActor, approvalId: string, note: unknown) {
  const id = uuidOrThrow(approvalId);
  return asAdmin(actor, async (tx) => {
    const [a] = await tx.select().from(approvals).where(eq(approvals.id, id)).for("update");
    if (!a) throw new NotFoundError();
    if (a.status !== "pending") throw new ValidationError("This request has already been decided");
    if (a.requestedBy === actor.userId) throw new ForbiddenError("Cancel your own request instead of rejecting it");
    await tx
      .update(approvals)
      .set({ status: "rejected", decidedBy: actor.userId, decidedAt: new Date(), decisionNote: optText(note, 1000) })
      .where(eq(approvals.id, id));
    await logActivity(tx, actor, "approval.rejected", "raise", a.raiseId, { approvalId: id, kind: a.kind });
  });
}

export async function cancel(actor: AdminActor, approvalId: string) {
  const id = uuidOrThrow(approvalId);
  return asAdmin(actor, async (tx) => {
    const [a] = await tx.select().from(approvals).where(eq(approvals.id, id)).for("update");
    if (!a) throw new NotFoundError();
    if (a.status !== "pending") throw new ValidationError("This request has already been decided");
    if (a.requestedBy !== actor.userId) throw new ForbiddenError("Only the requester can cancel a request");
    await tx.update(approvals).set({ status: "cancelled", decidedAt: new Date() }).where(eq(approvals.id, id));
    await logActivity(tx, actor, "approval.cancelled", "raise", a.raiseId, { approvalId: id, kind: a.kind });
  });
}

/** Pending requests across all raises, for the pipeline page. */
export async function listPending(actor: AdminActor) {
  return asAdmin(actor, (tx) =>
    tx
      .select({ a: approvals, requestedByName: users.name, borrowerName: borrowers.name, cycleStart: raises.cycleStart, cycle: raises.cycle })
      .from(approvals)
      .innerJoin(raises, eq(raises.id, approvals.raiseId))
      .innerJoin(borrowers, eq(borrowers.id, raises.borrowerId))
      .leftJoin(users, eq(users.id, approvals.requestedBy))
      .where(and(eq(approvals.status, "pending")))
      .orderBy(desc(approvals.requestedAt)),
  );
}
