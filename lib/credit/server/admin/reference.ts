import "server-only";
import { asc, eq } from "drizzle-orm";
import { segments, securityLevels, checklistTemplate, instruments } from "@/lib/credit/schema";
import { type AdminActor, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optText, reqText, uuidOrThrow } from "./common";

export async function listReference(actor: AdminActor) {
  return asAdmin(actor, async (tx) => ({
    segments: await tx.select().from(segments).orderBy(asc(segments.name)),
    securityLevels: await tx.select().from(securityLevels).orderBy(asc(securityLevels.rank), asc(securityLevels.name)),
    checklist: await tx.select().from(checklistTemplate).orderBy(asc(checklistTemplate.sort), asc(checklistTemplate.title)),
    instruments: await tx.select().from(instruments).orderBy(asc(instruments.name)),
  }));
}

export async function addSegment(actor: AdminActor, name: unknown) {
  const n = reqText(name, "Segment name", 100);
  return asAdmin(actor, async (tx) => {
    const [dupe] = await tx.select().from(segments).where(eq(segments.name, n));
    if (dupe) throw new ValidationError("That segment already exists");
    const [row] = await tx.insert(segments).values({ name: n }).returning();
    await logActivity(tx, actor, "segment.created", "segment", row.id, { name: n });
  });
}

export async function addSecurityLevel(actor: AdminActor, name: unknown, rank: unknown) {
  const n = reqText(name, "Security level name", 100);
  const r = Number(rank);
  if (!Number.isInteger(r) || r < 0 || r > 100) throw new ValidationError("Rank must be a whole number (lower = more secure)");
  return asAdmin(actor, async (tx) => {
    const [dupe] = await tx.select().from(securityLevels).where(eq(securityLevels.name, n));
    if (dupe) throw new ValidationError("That security level already exists");
    const [row] = await tx.insert(securityLevels).values({ name: n, rank: r }).returning();
    await logActivity(tx, actor, "security_level.created", "security_level", row.id, { name: n, rank: r });
  });
}

export async function addChecklistItem(actor: AdminActor, title: unknown, description: unknown) {
  const t = reqText(title, "Checklist item", 200);
  return asAdmin(actor, async (tx) => {
    const existing = await tx.select().from(checklistTemplate);
    const [row] = await tx
      .insert(checklistTemplate)
      .values({ title: t, description: optText(description, 1000), sort: existing.length })
      .returning();
    await logActivity(tx, actor, "checklist_template.added", "checklist_template", row.id, { title: t });
  });
}

export async function removeChecklistItem(actor: AdminActor, id: string) {
  const itemId = uuidOrThrow(id);
  return asAdmin(actor, async (tx) => {
    await tx.delete(checklistTemplate).where(eq(checklistTemplate.id, itemId));
    await logActivity(tx, actor, "checklist_template.removed", "checklist_template", itemId);
  });
}

export async function addInstrument(actor: AdminActor, name: unknown) {
  const n = reqText(name, "Instrument name", 100);
  return asAdmin(actor, async (tx) => {
    const [dupe] = await tx.select().from(instruments).where(eq(instruments.name, n));
    if (dupe) throw new ValidationError("That instrument already exists");
    const [row] = await tx.insert(instruments).values({ name: n }).returning();
    await logActivity(tx, actor, "instrument.created", "instrument", row.id, { name: n });
  });
}
