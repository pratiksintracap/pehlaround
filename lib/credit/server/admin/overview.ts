import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { accessRequests, activityLog, borrowers, diligenceL1, raises, users } from "@/lib/credit/schema";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, uuidOrThrow } from "./common";
import { effectiveL1Status } from "../diligence-rules";

export async function pipelineOverview(actor: AdminActor) {
  return asAdmin(actor, async (tx) => {
    const byStatus = await tx
      .select({ status: raises.status, n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${raises.amount}),0)::text`, filled: sql<string>`coalesce(sum(${raises.filledAmount}),0)::text` })
      .from(raises)
      .groupBy(raises.status);
    const l1 = await tx
      .select({ borrowerId: borrowers.id, name: borrowers.name, status: diligenceL1.status, refreshDueAt: diligenceL1.refreshDueAt })
      .from(borrowers)
      .leftJoin(diligenceL1, eq(diligenceL1.borrowerId, borrowers.id));
    const l1Rows = l1.map((r) => ({ ...r, effective: effectiveL1Status(r.status ? { status: r.status, refreshDueAt: r.refreshDueAt } : null) }));
    const newRequests = await tx.select({ n: sql<number>`count(*)::int` }).from(accessRequests).where(eq(accessRequests.status, "new"));
    return {
      byStatus,
      l1Counts: l1Rows.reduce<Record<string, number>>((acc, r) => ((acc[r.effective] = (acc[r.effective] ?? 0) + 1), acc), {}),
      needsAttention: l1Rows.filter((r) => ["refresh_due", "refresh_required", "in_review"].includes(r.effective)),
      newAccessRequests: newRequests[0]?.n ?? 0,
    };
  });
}

export async function listActivity(actor: AdminActor, filter: { entityType?: string; entityId?: string; limit?: number } = {}) {
  return asAdmin(actor, async (tx) => {
    const conds = [];
    if (filter.entityType) conds.push(eq(activityLog.entityType, filter.entityType));
    if (filter.entityId) conds.push(eq(activityLog.entityId, filter.entityId));
    return tx
      .select({ log: activityLog, actorName: users.name, actorEmail: users.email })
      .from(activityLog)
      .leftJoin(users, eq(users.id, activityLog.actorUserId))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(activityLog.id))
      .limit(Math.min(filter.limit ?? 200, 1000));
  });
}

export async function listAccessRequests(actor: AdminActor) {
  return asAdmin(actor, (tx) => tx.select().from(accessRequests).orderBy(desc(accessRequests.createdAt)));
}

export async function setAccessRequestStatus(actor: AdminActor, id: string, status: unknown) {
  const rid = uuidOrThrow(id);
  const s = String(status);
  if (!["new", "contacted", "approved", "declined"].includes(s)) throw new ValidationError("Invalid status");
  return asAdmin(actor, async (tx) => {
    const res = await tx
      .update(accessRequests)
      .set({ status: s as "new" })
      .where(eq(accessRequests.id, rid))
      .returning({ id: accessRequests.id });
    if (!res.length) throw new NotFoundError();
    await logActivity(tx, actor, "access_request.status", "access_request", rid, { to: s });
  });
}

/**
 * Erases an access request (DPDP: when consent is withdrawn or the purpose is served). The row is deleted;
 * the activity log keeps only that an erasure happened, with no personal data.
 */
export async function eraseAccessRequest(actor: AdminActor, id: string) {
  const rid = uuidOrThrow(id);
  return asAdmin(actor, async (tx) => {
    const res = await tx.delete(accessRequests).where(eq(accessRequests.id, rid)).returning({ id: accessRequests.id });
    if (!res.length) throw new NotFoundError();
    await logActivity(tx, actor, "access_request.erased", "access_request", rid);
  });
}
