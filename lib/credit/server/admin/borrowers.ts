import "server-only";
import { asc, desc, eq, and, inArray, isNull } from "drizzle-orm";
import {
  borrowers,
  borrowerSegments,
  checklistTemplate,
  diligenceItems,
  diligenceL1,
  diligenceL1History,
  documents,
  lenderReviews,
  lenders,
  raises,
  segments,
} from "@/lib/credit/schema";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optText, reqText, uuidOrThrow } from "./common";
import { refreshDueFrom } from "../diligence-rules";
import { putObject, MAX_UPLOAD_BYTES, checkFileContent } from "../storage";
import { isDrawdownCycle, type DrawdownCycle } from "../cycles";

export async function listBorrowers(actor: AdminActor) {
  return asAdmin(actor, async (tx) => {
    const rows = await tx
      .select({ b: borrowers, l1: diligenceL1 })
      .from(borrowers)
      .leftJoin(diligenceL1, eq(diligenceL1.borrowerId, borrowers.id))
      .orderBy(asc(borrowers.name));
    const segs = await tx
      .select({ borrowerId: borrowerSegments.borrowerId, name: segments.name })
      .from(borrowerSegments)
      .innerJoin(segments, eq(segments.id, borrowerSegments.segmentId));
    const recent = await tx.select().from(raises).orderBy(desc(raises.cycleStart));
    return rows.map(({ b, l1 }) => ({
      ...b,
      l1,
      segments: segs.filter((s) => s.borrowerId === b.id).map((s) => s.name),
      latestRaise: recent.find((r) => r.borrowerId === b.id) ?? null,
      raiseCount: recent.filter((r) => r.borrowerId === b.id).length,
    }));
  });
}

export async function getBorrower(actor: AdminActor, id: string) {
  const borrowerId = uuidOrThrow(id);
  return asAdmin(actor, async (tx) => {
    const [b] = await tx.select().from(borrowers).where(eq(borrowers.id, borrowerId));
    if (!b) throw new NotFoundError();
    const [l1] = await tx.select().from(diligenceL1).where(eq(diligenceL1.borrowerId, borrowerId));
    const items = await tx.select().from(diligenceItems).where(eq(diligenceItems.borrowerId, borrowerId)).orderBy(asc(diligenceItems.sort));
    const docs = await tx.select().from(documents).where(eq(documents.borrowerId, borrowerId)).orderBy(desc(documents.createdAt));
    const segmentIds = (await tx.select().from(borrowerSegments).where(eq(borrowerSegments.borrowerId, borrowerId))).map((s) => s.segmentId);
    const l2 = await tx
      .select({ review: lenderReviews, lenderName: lenders.name })
      .from(lenderReviews)
      .innerJoin(lenders, eq(lenders.id, lenderReviews.lenderId))
      .where(eq(lenderReviews.borrowerId, borrowerId))
      .orderBy(asc(lenders.name));
    const raiseRows = await tx.select().from(raises).where(eq(raises.borrowerId, borrowerId)).orderBy(desc(raises.cycleStart));
    const l1History = await tx.select().from(diligenceL1History).where(eq(diligenceL1History.borrowerId, borrowerId)).orderBy(desc(diligenceL1History.decidedAt));
    return { borrower: b, l1: l1 ?? null, l1History, items, docs, segmentIds, l2, raises: raiseRows };
  });
}

export type BorrowerInput = {
  name: unknown;
  cin?: unknown;
  rbiRegistration?: unknown;
  city?: unknown;
  state?: unknown;
  status?: unknown;
  /** monthly | quarterly | yearly. Omitted or empty: 'monthly' for a new borrower, unchanged on edit. */
  drawdownCycle?: unknown;
  notes?: unknown;
  segmentIds?: string[];
};

const BORROWER_STATUSES = ["prospect", "onboarding", "active", "inactive"] as const;

function parseBorrower(input: BorrowerInput) {
  const status = String(input.status ?? "prospect");
  if (!(BORROWER_STATUSES as readonly string[]).includes(status)) throw new ValidationError("Invalid status");
  const rawCycle = String(input.drawdownCycle ?? "").trim();
  if (rawCycle && !isDrawdownCycle(rawCycle)) throw new ValidationError("Drawdown cycle must be monthly, quarterly or yearly");
  const drawdownCycle: DrawdownCycle | undefined = rawCycle ? (rawCycle as DrawdownCycle) : undefined;
  return {
    v: {
      name: reqText(input.name, "Borrower name", 200),
      cin: optText(input.cin, 50),
      rbiRegistration: optText(input.rbiRegistration, 50),
      city: optText(input.city, 100),
      state: optText(input.state, 100),
      status: status as (typeof BORROWER_STATUSES)[number],
      notes: optText(input.notes),
      ...(drawdownCycle ? { drawdownCycle } : {}),
    },
    segmentIds: (input.segmentIds ?? []).map(uuidOrThrow),
  };
}

export async function saveBorrower(actor: AdminActor, id: string | null, input: BorrowerInput): Promise<string> {
  const { v, segmentIds } = parseBorrower(input);
  return asAdmin(actor, async (tx) => {
    let borrowerId: string;
    let before: unknown = null;
    if (id) {
      borrowerId = uuidOrThrow(id);
      const [existing] = await tx.select().from(borrowers).where(eq(borrowers.id, borrowerId));
      if (!existing) throw new NotFoundError();
      before = existing;
      await tx.update(borrowers).set({ ...v, updatedAt: new Date() }).where(eq(borrowers.id, borrowerId));
    } else {
      const [row] = await tx.insert(borrowers).values(v).returning({ id: borrowers.id });
      borrowerId = row.id;
      await tx.insert(diligenceL1).values({ borrowerId });
      // Apply the platform's default Level 1 checklist.
      const template = await tx.select().from(checklistTemplate).orderBy(asc(checklistTemplate.sort));
      if (template.length) {
        await tx.insert(diligenceItems).values(template.map((t, i) => ({ borrowerId, title: t.title, description: t.description, sort: i })));
      }
    }
    await tx.delete(borrowerSegments).where(eq(borrowerSegments.borrowerId, borrowerId));
    if (segmentIds.length) await tx.insert(borrowerSegments).values(segmentIds.map((segmentId) => ({ borrowerId, segmentId })));
    await logActivity(tx, actor, id ? "borrower.updated" : "borrower.created", "borrower", borrowerId, { before, after: { ...v, segmentIds } });
    return borrowerId;
  });
}

// ---------- Level 1 diligence ----------

export async function addDiligenceItem(actor: AdminActor, borrowerId: string, title: unknown, description: unknown) {
  const bId = uuidOrThrow(borrowerId);
  const t = reqText(title, "Item title", 200);
  return asAdmin(actor, async (tx) => {
    const [b] = await tx.select({ id: borrowers.id }).from(borrowers).where(eq(borrowers.id, bId));
    if (!b) throw new NotFoundError();
    const count = (await tx.select({ id: diligenceItems.id }).from(diligenceItems).where(eq(diligenceItems.borrowerId, bId))).length;
    const [row] = await tx.insert(diligenceItems).values({ borrowerId: bId, title: t, description: optText(description, 1000), sort: count }).returning();
    await logActivity(tx, actor, "diligence_item.added", "borrower", bId, { itemId: row.id, title: t });
  });
}

const ITEM_STATUSES = ["pending", "received", "accepted", "rejected"] as const;

export async function setDiligenceItemStatus(actor: AdminActor, itemId: string, status: unknown, note: unknown) {
  const id = uuidOrThrow(itemId);
  const s = String(status);
  if (!(ITEM_STATUSES as readonly string[]).includes(s)) throw new ValidationError("Invalid status");
  return asAdmin(actor, async (tx) => {
    const [item] = await tx.select().from(diligenceItems).where(eq(diligenceItems.id, id));
    if (!item) throw new NotFoundError();
    await tx
      .update(diligenceItems)
      .set({ status: s as (typeof ITEM_STATUSES)[number], reviewNote: optText(note, 2000), reviewedBy: actor.userId, reviewedAt: new Date() })
      .where(eq(diligenceItems.id, id));
    await logActivity(tx, actor, "diligence_item.status", "borrower", item.borrowerId, {
      itemId: id,
      title: item.title,
      from: item.status,
      to: s,
    });
  });
}

export async function uploadDocument(
  actor: AdminActor,
  borrowerId: string,
  itemId: string | null,
  file: { name: string; type: string; data: Buffer },
  /** When uploading against a checklist item: mark that item's current files as earlier versions. */
  replacesPrevious = false,
) {
  const bId = uuidOrThrow(borrowerId);
  const iId = itemId ? uuidOrThrow(itemId) : null;
  if (file.data.length === 0) throw new ValidationError("The file is empty");
  if (file.data.length > MAX_UPLOAD_BYTES) throw new ValidationError(`File is larger than ${Math.floor(MAX_UPLOAD_BYTES / 1048576)} MB`);
  const contentType = checkFileContent(file.name, file.data);
  if (!contentType) throw new ValidationError("File type not allowed, or the file doesn't match its extension (PDF, PNG, JPEG, Excel, Word, CSV or ZIP)");
  const filename = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 200) || "document";
  return asAdmin(actor, async (tx) => {
    const [b] = await tx.select({ id: borrowers.id }).from(borrowers).where(eq(borrowers.id, bId));
    if (!b) throw new NotFoundError();
    if (iId) {
      const [item] = await tx.select().from(diligenceItems).where(and(eq(diligenceItems.id, iId), eq(diligenceItems.borrowerId, bId)));
      if (!item) throw new NotFoundError();
      if (item.status === "pending") await tx.update(diligenceItems).set({ status: "received" }).where(eq(diligenceItems.id, iId));
      if (replacesPrevious) {
        await tx
          .update(documents)
          .set({ supersededAt: new Date() })
          .where(and(eq(documents.diligenceItemId, iId), isNull(documents.supersededAt)));
        // A replaced file needs review again.
        if (item.status === "accepted" || item.status === "rejected") {
          await tx.update(diligenceItems).set({ status: "received" }).where(eq(diligenceItems.id, iId));
        }
      }
    }
    const { key, sha256 } = await putObject(file.data);
    const [doc] = await tx
      .insert(documents)
      .values({ borrowerId: bId, diligenceItemId: iId, filename, contentType, sizeBytes: file.data.length, sha256, storageKey: key, uploadedBy: actor.userId })
      .returning({ id: documents.id });
    await logActivity(tx, actor, "document.uploaded", "borrower", bId, { documentId: doc.id, itemId: iId, filename, sha256, replacesPrevious });
    return doc.id;
  });
}

const L1_STATUSES = ["not_started", "in_review", "approved", "rejected", "refresh_required"] as const;

/** Level 1 review decision. Approval stamps the next quarterly refresh date. */
export async function setL1Status(actor: AdminActor, borrowerId: string, status: unknown, notes: unknown) {
  const bId = uuidOrThrow(borrowerId);
  const s = String(status);
  if (!(L1_STATUSES as readonly string[]).includes(s)) throw new ValidationError("Invalid status");
  return asAdmin(actor, async (tx) => {
    const [row] = await tx.select().from(diligenceL1).where(eq(diligenceL1.borrowerId, bId));
    if (!row) throw new NotFoundError();
    if (s === "approved") {
      const open = await tx
        .select({ id: diligenceItems.id })
        .from(diligenceItems)
        .where(and(eq(diligenceItems.borrowerId, bId), inArray(diligenceItems.status, ["pending", "received", "rejected"])));
      if (open.length) throw new ValidationError(`${open.length} checklist item(s) are not yet accepted`);
    }
    const now = new Date();
    await tx
      .update(diligenceL1)
      .set({
        status: s as (typeof L1_STATUSES)[number],
        notes: optText(notes) ?? row.notes,
        reviewedBy: actor.userId,
        reviewedAt: now,
        approvedAt: s === "approved" ? now : row.approvedAt,
        refreshDueAt: s === "approved" ? refreshDueFrom(now) : row.refreshDueAt,
        updatedAt: now,
      })
      .where(eq(diligenceL1.borrowerId, bId));
    await tx.insert(diligenceL1History).values({ borrowerId: bId, status: s as (typeof L1_STATUSES)[number], decidedBy: actor.userId, decidedAt: now });
    await logActivity(tx, actor, "diligence_l1.status", "borrower", bId, { from: row.status, to: s });
  });
}

/** Admins can also record a lender's Level 2 status on the lender's behalf (e.g. told by phone). */
export async function setLenderReviewAsAdmin(actor: AdminActor, lenderId: string, borrowerId: string, status: unknown, notes: unknown) {
  const lId = uuidOrThrow(lenderId);
  const bId = uuidOrThrow(borrowerId);
  const s = String(status);
  if (!["not_started", "in_review", "approved", "rejected"].includes(s)) throw new ValidationError("Invalid status");
  return asAdmin(actor, async (tx) => {
    const values = { status: s as "not_started", notes: optText(notes), updatedBy: actor.userId, updatedAt: new Date() };
    await tx
      .insert(lenderReviews)
      .values({ lenderId: lId, borrowerId: bId, ...values })
      .onConflictDoUpdate({ target: [lenderReviews.lenderId, lenderReviews.borrowerId], set: values });
    await logActivity(tx, actor, "diligence_l2.status", "borrower", bId, { lenderId: lId, to: s });
  });
}
