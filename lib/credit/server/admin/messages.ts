import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Tx } from "@/lib/credit/db";
import { dealMessages, dealShares, diligenceItems, lenders, raises, users } from "@/lib/credit/schema";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optText, reqText, uuidOrThrow } from "./common";
import { notifyLenderOfReply } from "../notify";

/** All Q&A threads on a raise, one per lender it has been shared with. */
export async function listThreads(actor: AdminActor, raiseId: string) {
  const id = uuidOrThrow(raiseId);
  return asAdmin(actor, async (tx) => {
    const msgs = await tx
      .select({ m: dealMessages, authorName: users.name })
      .from(dealMessages)
      .leftJoin(users, eq(users.id, dealMessages.authorUserId))
      .where(eq(dealMessages.raiseId, id))
      .orderBy(asc(dealMessages.createdAt));
    const shares = await tx
      .select({ lenderId: dealShares.lenderId, lenderName: lenders.name, revokedAt: dealShares.revokedAt })
      .from(dealShares)
      .innerJoin(lenders, eq(lenders.id, dealShares.lenderId))
      .where(eq(dealShares.raiseId, id))
      .orderBy(asc(lenders.name));
    return shares.map((s) => {
      const thread = msgs.filter((x) => x.m.lenderId === s.lenderId);
      const last = thread.at(-1);
      return { ...s, messages: thread, awaitingReply: last?.m.authorSide === "lender" };
    });
  });
}

async function requireActiveShare(tx: Tx, raiseId: string, lenderId: string) {
  const [share] = await tx
    .select({ id: dealShares.id })
    .from(dealShares)
    .where(and(eq(dealShares.raiseId, raiseId), eq(dealShares.lenderId, lenderId), isNull(dealShares.revokedAt)));
  if (!share) throw new ValidationError("This raise isn't currently shared with that lender");
}

export async function postPlatformMessage(actor: AdminActor, raiseId: string, lenderId: string, body: unknown) {
  const rId = uuidOrThrow(raiseId);
  const lId = uuidOrThrow(lenderId);
  const text = reqText(body, "Message", 5000);
  await asAdmin(actor, async (tx) => {
    await requireActiveShare(tx, rId, lId);
    await tx.insert(dealMessages).values({ raiseId: rId, lenderId: lId, authorUserId: actor.userId, authorSide: "platform", body: text });
    await logActivity(tx, actor, "message.platform", "raise", rId, { lenderId: lId });
  });
  await notifyLenderOfReply(lId, rId);
}

/**
 * A lender asked for a document: add it to the borrower's Level 1 checklist (so it's collected and reviewed
 * like any other item, and visible to every lender on the borrower's raises) and note it in that lender's thread.
 */
export async function requestDocumentForLender(actor: AdminActor, raiseId: string, lenderId: string, title: unknown, description: unknown) {
  const rId = uuidOrThrow(raiseId);
  const lId = uuidOrThrow(lenderId);
  const t = reqText(title, "Document", 200);
  await asAdmin(actor, async (tx) => {
    await requireActiveShare(tx, rId, lId);
    const [r] = await tx.select({ borrowerId: raises.borrowerId }).from(raises).where(eq(raises.id, rId));
    if (!r) throw new NotFoundError();
    const count = (await tx.select({ id: diligenceItems.id }).from(diligenceItems).where(eq(diligenceItems.borrowerId, r.borrowerId))).length;
    const [item] = await tx
      .insert(diligenceItems)
      .values({ borrowerId: r.borrowerId, title: t, description: optText(description, 1000), sort: count })
      .returning({ id: diligenceItems.id });
    await tx.insert(dealMessages).values({
      raiseId: rId,
      lenderId: lId,
      authorUserId: actor.userId,
      authorSide: "platform",
      body: `Added to the Level 1 checklist: "${t}". It will appear in the diligence section once received.`,
    });
    await logActivity(tx, actor, "diligence_item.requested", "borrower", r.borrowerId, { itemId: item.id, title: t, raiseId: rId, lenderId: lId });
  });
  await notifyLenderOfReply(lId, rId);
}
