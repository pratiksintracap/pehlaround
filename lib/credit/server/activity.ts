import "server-only";
import type { Tx } from "@/lib/credit/db";
import { activityLog } from "@/lib/credit/schema";
import type { Actor } from "./actors";

/**
 * Append-only activity log. Every mutating service call writes one row in the same transaction as the change,
 * so a change cannot be committed without its log entry.
 */
export async function logActivity(
  tx: Tx,
  actor: Actor | { kind: "system"; role: "auth" | "intake" | "outreach" | "applicant"; userId?: string | null },
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  await tx.insert(activityLog).values({
    actorUserId: actor.kind === "system" ? (actor.userId ?? null) : actor.userId,
    actorRole: actor.kind === "admin" ? "platform_admin" : actor.kind === "partner" ? "partner" : actor.kind === "applicant_user" ? "applicant" : actor.role,
    lenderId: actor.kind === "lender" ? actor.lenderId : null,
    action,
    entityType,
    entityId,
    details: details ?? null,
  });
}
