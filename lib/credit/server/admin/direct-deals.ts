import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Tx } from "@/lib/credit/db";
import { directDealFiles, directDealLenders, directDeals, lenders, prospectSettings } from "@/lib/credit/schema";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { checkFileContent, getObject, putObject } from "../storage";
import { INTAKE_MAX_BYTES, PART_BYTES, allowedName, expectedPartSize, partCountFor, safeFilename } from "../intake/files";
import { asAdmin, optText, reqText, uuidOrThrow } from "./common";

/*
 * Direct deals: large lending requirements from companies that aren't NBFCs, arranged by the desk with lenders.
 * Platform team only (RLS admin_all). Amounts are in ₹ crore.
 */

export const DEAL_STAGES = ["lead", "diligence", "with_lenders", "term_sheet", "sanctioned", "disbursed", "on_hold", "closed_lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export const OPEN_STAGES: DealStage[] = ["lead", "diligence", "with_lenders", "term_sheet", "sanctioned"];
export const LENDER_STATUSES = ["to_approach", "approached", "interested", "term_sheet", "sanctioned", "declined"] as const;
export type LenderStatus = (typeof LENDER_STATUSES)[number];
export const FACILITIES = [
  "Term loan",
  "Working capital",
  "Capex / project finance",
  "Loan against property",
  "Loan against shares",
  "Acquisition / structured finance",
  "NCDs",
  "Other",
];

const CR_RE = /^\d{1,9}(\.\d{1,2})?$/;
function crore(v: unknown, field: string, required = false): string | null {
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (!s) {
    if (required) throw new ValidationError(`${field} is required`);
    return null;
  }
  if (!CR_RE.test(s) || Number(s) <= 0) throw new ValidationError(`${field}: enter an amount in ₹ crore, e.g. 65 or 32.5`);
  return s;
}
function optDate(v: unknown, field: string): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ValidationError(`${field}: choose a date`);
  return s;
}
function optEmail(v: unknown): string | null {
  const s = optText(v, 200)?.toLowerCase() ?? null;
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ValidationError("Contact email doesn't look right");
  return s;
}

export type DealInput = Record<string, unknown>;

function parseDeal(input: DealInput) {
  const tenor = String(input.tenorMonths ?? "").trim();
  if (tenor && (!/^\d{1,3}$/.test(tenor) || Number(tenor) < 1)) throw new ValidationError("Tenor: enter months, e.g. 36");
  const stage = String(input.stage ?? "lead");
  if (!(DEAL_STAGES as readonly string[]).includes(stage)) throw new ValidationError("Choose a stage");
  const facility = optText(input.facility, 100);
  if (facility && !FACILITIES.includes(facility)) throw new ValidationError("Choose a facility type");
  return {
    companyName: reqText(input.companyName, "Company", 200),
    cin: optText(input.cin, 30)?.toUpperCase() ?? null,
    sector: optText(input.sector, 200),
    city: optText(input.city, 100),
    state: optText(input.state, 100),
    amountCr: crore(input.amountCr, "Amount", true)!,
    facility,
    purpose: optText(input.purpose, 2000),
    tenorMonths: tenor ? Number(tenor) : null,
    security: optText(input.security, 2000),
    rateExpectation: optText(input.rateExpectation, 100),
    stage: stage as DealStage,
    source: optText(input.source, 300),
    contactName: optText(input.contactName, 200),
    contactRole: optText(input.contactRole, 200),
    contactEmail: optEmail(input.contactEmail),
    contactPhone: optText(input.contactPhone, 50),
    nextStep: optText(input.nextStep, 500),
    nextStepOn: optDate(input.nextStepOn, "Next step date"),
    notes: optText(input.notes, 8000),
  };
}

async function loadMin(tx: Tx): Promise<string> {
  const [r] = await tx.select({ m: prospectSettings.directMinCr }).from(prospectSettings).where(eq(prospectSettings.id, 1));
  return r?.m ?? "25";
}

export async function saveDirectMin(actor: AdminActor, v: unknown) {
  const m = crore(v, "Minimum deal size", true)!;
  return asAdmin(actor, async (tx) => {
    await tx
      .insert(prospectSettings)
      .values({ id: 1, directMinCr: m, updatedBy: actor.userId })
      .onConflictDoUpdate({ target: prospectSettings.id, set: { directMinCr: m, updatedBy: actor.userId, updatedAt: new Date() } });
    await logActivity(tx, actor, "direct_deal.min_size", "settings", "1", { minCr: m });
  });
}

export async function listDirectDeals(actor: AdminActor, f: { view?: string; stage?: string } = {}) {
  return asAdmin(actor, async (tx) => {
    const minCr = await loadMin(tx);
    const where =
      f.stage && (DEAL_STAGES as readonly string[]).includes(f.stage)
        ? eq(directDeals.stage, f.stage as DealStage)
        : f.view === "all"
          ? undefined
          : sql`${directDeals.stage} in ('lead', 'diligence', 'with_lenders', 'term_sheet', 'sanctioned')`;
    const rows = await tx.select().from(directDeals).where(where).orderBy(desc(directDeals.updatedAt));
    const ls = await tx
      .select({ dealId: directDealLenders.dealId, status: directDealLenders.status, amountCr: directDealLenders.amountCr })
      .from(directDealLenders);
    const counts = await tx.select({ stage: directDeals.stage, n: sql<number>`count(*)::int`, cr: sql<string>`coalesce(sum(${directDeals.amountCr}), 0)::text` }).from(directDeals).groupBy(directDeals.stage);
    return {
      minCr,
      counts: Object.fromEntries(counts.map((c) => [c.stage, { n: c.n, cr: c.cr }])) as Partial<Record<DealStage, { n: number; cr: string }>>,
      rows: rows.map((d) => {
        const mine = ls.filter((l) => l.dealId === d.id);
        const committed = mine.filter((l) => l.status === "sanctioned" || l.status === "term_sheet").reduce((s, l) => s + Number(l.amountCr ?? 0), 0);
        return {
          ...d,
          belowMin: Number(d.amountCr) < Number(minCr),
          lenderCount: mine.length,
          approached: mine.filter((l) => l.status !== "to_approach").length,
          interested: mine.filter((l) => ["interested", "term_sheet", "sanctioned"].includes(l.status)).length,
          committedCr: committed,
        };
      }),
    };
  });
}

export async function createDirectDeal(actor: AdminActor, input: DealInput): Promise<string> {
  const v = parseDeal(input);
  return asAdmin(actor, async (tx) => {
    const [row] = await tx.insert(directDeals).values({ ...v, createdBy: actor.userId, updatedBy: actor.userId }).returning({ id: directDeals.id });
    await logActivity(tx, actor, "direct_deal.created", "direct_deal", row.id, { companyName: v.companyName, amountCr: v.amountCr });
    return row.id;
  });
}

export async function updateDirectDeal(actor: AdminActor, id: string, input: DealInput) {
  const did = uuidOrThrow(id);
  const v = parseDeal(input);
  return asAdmin(actor, async (tx) => {
    const [cur] = await tx.select().from(directDeals).where(eq(directDeals.id, did));
    if (!cur) throw new NotFoundError();
    await tx.update(directDeals).set({ ...v, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(directDeals.id, did));
    const changed = Object.fromEntries(
      Object.entries(v).filter(([k, x]) => String((cur as Record<string, unknown>)[k] ?? "") !== String(x ?? "")).map(([k, x]) => [k, [(cur as Record<string, unknown>)[k] ?? null, x]]),
    );
    await logActivity(tx, actor, "direct_deal.updated", "direct_deal", did, { changed });
  });
}

export async function getDirectDeal(actor: AdminActor, id: string) {
  return asAdmin(actor, async (tx) => {
    const [d] = await tx.select().from(directDeals).where(eq(directDeals.id, uuidOrThrow(id)));
    if (!d) throw new NotFoundError();
    const ls = await tx
      .select({ l: directDealLenders, platformName: lenders.name })
      .from(directDealLenders)
      .leftJoin(lenders, eq(lenders.id, directDealLenders.lenderId))
      .where(eq(directDealLenders.dealId, d.id))
      .orderBy(asc(directDealLenders.updatedAt));
    const files = await tx
      .select({ id: directDealFiles.id, filename: directDealFiles.filename, sizeBytes: directDealFiles.sizeBytes, createdAt: directDealFiles.createdAt })
      .from(directDealFiles)
      .where(and(eq(directDealFiles.dealId, d.id), isNotNull(directDealFiles.completedAt)))
      .orderBy(asc(directDealFiles.createdAt));
    const platformLenders = await tx
      .select({ id: lenders.id, name: lenders.name, minTicket: lenders.minTicket, maxTicket: lenders.maxTicket })
      .from(lenders)
      .where(eq(lenders.active, true))
      .orderBy(asc(lenders.name));
    return {
      deal: d,
      minCr: await loadMin(tx),
      lenders: ls.map(({ l, platformName }) => ({ ...l, name: platformName ?? l.lenderName ?? "—", onPlatform: Boolean(l.lenderId) })),
      files,
      platformLenders,
    };
  });
}

export async function addDealLender(actor: AdminActor, dealId: string, input: { lenderId: unknown; lenderName: unknown }) {
  const did = uuidOrThrow(dealId);
  const lid = String(input.lenderId ?? "").trim();
  const name = optText(input.lenderName, 200);
  if (!lid && !name) throw new ValidationError("Pick a lender on the platform, or type a lender's name");
  return asAdmin(actor, async (tx) => {
    const [d] = await tx.select({ id: directDeals.id }).from(directDeals).where(eq(directDeals.id, did));
    if (!d) throw new NotFoundError();
    if (lid) {
      const [l] = await tx.select({ id: lenders.id }).from(lenders).where(eq(lenders.id, uuidOrThrow(lid)));
      if (!l) throw new NotFoundError();
      const [dupe] = await tx.select({ id: directDealLenders.id }).from(directDealLenders).where(and(eq(directDealLenders.dealId, did), eq(directDealLenders.lenderId, lid)));
      if (dupe) throw new ValidationError("That lender is already on this deal");
    }
    const [row] = await tx
      .insert(directDealLenders)
      .values({ dealId: did, lenderId: lid || null, lenderName: lid ? null : name, updatedBy: actor.userId })
      .returning({ id: directDealLenders.id });
    await logActivity(tx, actor, "direct_deal.lender_added", "direct_deal", did, { rowId: row.id, lenderId: lid || null, lenderName: name });
  });
}

export async function updateDealLender(actor: AdminActor, rowId: string, input: { status: unknown; amountCr: unknown; rate: unknown; note: unknown }) {
  const rid = uuidOrThrow(rowId);
  const status = String(input.status ?? "");
  if (!(LENDER_STATUSES as readonly string[]).includes(status)) throw new ValidationError("Choose a status");
  const amountCr = crore(input.amountCr, "Amount");
  return asAdmin(actor, async (tx) => {
    const [cur] = await tx.select().from(directDealLenders).where(eq(directDealLenders.id, rid));
    if (!cur) throw new NotFoundError();
    const v = { status: status as LenderStatus, amountCr, rate: optText(input.rate, 100), note: optText(input.note, 2000) };
    await tx.update(directDealLenders).set({ ...v, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(directDealLenders.id, rid));
    await tx.update(directDeals).set({ updatedAt: new Date(), updatedBy: actor.userId }).where(eq(directDeals.id, cur.dealId));
    await logActivity(tx, actor, "direct_deal.lender_updated", "direct_deal", cur.dealId, { rowId: rid, from: cur.status, ...v });
  });
}

export async function removeDealLender(actor: AdminActor, rowId: string) {
  const rid = uuidOrThrow(rowId);
  return asAdmin(actor, async (tx) => {
    const [cur] = await tx.delete(directDealLenders).where(eq(directDealLenders.id, rid)).returning();
    if (!cur) throw new NotFoundError();
    await logActivity(tx, actor, "direct_deal.lender_removed", "direct_deal", cur.dealId, { rowId: rid, lenderId: cur.lenderId, lenderName: cur.lenderName });
  });
}

// ---------- files (same part-wise upload as the partner form) ----------

export async function startDealUpload(actor: AdminActor, dealId: string, input: { filename: unknown; size: unknown }) {
  const filename = safeFilename(String(input.filename ?? ""));
  const size = Number(input.size);
  if (!allowedName(filename)) throw new ValidationError("Use PDF, Excel, Word, CSV, PNG, JPEG or ZIP files");
  if (!Number.isInteger(size) || size <= 0) throw new ValidationError("The file is empty");
  if (size > INTAKE_MAX_BYTES) throw new ValidationError("Files can be up to 50 MB");
  return asAdmin(actor, async (tx) => {
    const [d] = await tx.select({ id: directDeals.id }).from(directDeals).where(eq(directDeals.id, uuidOrThrow(dealId)));
    if (!d) throw new NotFoundError();
    const partCount = partCountFor(size);
    const [row] = await tx
      .insert(directDealFiles)
      .values({ dealId: d.id, filename, sizeBytes: size, parts: Array<string>(partCount).fill(""), partCount, uploadedBy: actor.userId })
      .returning({ id: directDealFiles.id });
    return { fileId: row.id, partCount, partBytes: PART_BYTES };
  });
}

async function loadFile(tx: Tx, fileId: string) {
  const [f] = await tx.select().from(directDealFiles).where(eq(directDealFiles.id, uuidOrThrow(fileId)));
  if (!f) throw new NotFoundError();
  return f;
}

export async function putDealPart(actor: AdminActor, fileId: string, index: number, data: Buffer) {
  return asAdmin(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    if (f.completedAt) throw new ValidationError("This upload is already complete");
    if (!Number.isInteger(index) || index < 0 || index >= f.partCount) throw new ValidationError("Bad part number");
    if (data.length !== expectedPartSize(f.sizeBytes, index)) throw new ValidationError("Part size doesn't match the file");
    const { key } = await putObject(data);
    await tx.execute(sql`update direct_deal_files set parts[${index + 1}] = ${key} where id = ${f.id}`);
  });
}

export async function completeDealUpload(actor: AdminActor, fileId: string) {
  return asAdmin(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    if (f.completedAt) return { id: f.id, filename: f.filename, sizeBytes: f.sizeBytes };
    if (f.parts.some((p) => !p)) throw new ValidationError("Some of the file hasn't arrived. Please upload it again.");
    const first = await getObject(f.parts[0]);
    const contentType = checkFileContent(f.filename, first);
    if (!contentType) {
      await tx.delete(directDealFiles).where(eq(directDealFiles.id, f.id));
      throw new ValidationError(`${f.filename} doesn't look like a valid ${f.filename.split(".").pop()?.toUpperCase()} file`);
    }
    const sha256 = f.partCount === 1 ? createHash("sha256").update(first).digest("hex") : null;
    await tx.update(directDealFiles).set({ completedAt: new Date(), contentType, sha256 }).where(eq(directDealFiles.id, f.id));
    await tx.update(directDeals).set({ updatedAt: new Date(), updatedBy: actor.userId }).where(eq(directDeals.id, f.dealId));
    await logActivity(tx, actor, "direct_deal.file_uploaded", "direct_deal", f.dealId, { fileId: f.id, filename: f.filename, sizeBytes: f.sizeBytes });
    return { id: f.id, filename: f.filename, sizeBytes: f.sizeBytes };
  });
}

export async function deleteDealFile(actor: AdminActor, fileId: string) {
  return asAdmin(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    await tx.delete(directDealFiles).where(eq(directDealFiles.id, f.id));
    await logActivity(tx, actor, "direct_deal.file_deleted", "direct_deal", f.dealId, { fileId: f.id, filename: f.filename });
  });
}

export async function dealFileForDownload(actor: AdminActor, fileId: string) {
  return asAdmin(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    if (!f.completedAt) throw new NotFoundError();
    return f;
  });
}
