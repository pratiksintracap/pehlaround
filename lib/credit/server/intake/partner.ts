import "server-only";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { withContext, type Tx } from "@/lib/credit/db";
import { intakeFiles, intakeSubmissions, partners, prospectSettings } from "@/lib/credit/schema";
import { type AdminActor, type PartnerActor, NotFoundError, ValidationError, dbCtx } from "../actors";
import { logActivity } from "../activity";
import { checkFileContent, getObject, putObject } from "../storage";
import { uuidOrThrow } from "../admin/common";
import { notifyAdminsOfSubmission } from "../notify";
import { AnswerError, formFor, cleanAnswers, findQuestion, missingItems, submitProblems, type Answers } from "@/lib/credit/intake/definition";
import { INTAKE_MAX_BYTES, PART_BYTES, allowedName, expectedPartSize, partCountFor, safeFilename } from "./files";

/*
 * Partner-side service for the borrower information form. Every call runs in the partner's own database
 * context, so row-level security limits it to the partner firm's submissions whatever the code asks for.
 */

/** Someone filling a form from the public website, identified only by the hash of their form's private link. */
export type Applicant = { kind: "applicant"; tokenHash: string };
/** Who is filling a form: a signed-in partner, an applicant from the public site, or the platform team on someone's behalf. */
export type Who = PartnerActor | Applicant | AdminActor;

function asPartner<T>(actor: PartnerActor, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!actor || actor.kind !== "partner") throw new NotFoundError();
  return withContext(dbCtx(actor), fn);
}

function asWho<T>(who: Who, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (who?.kind === "partner" || who?.kind === "admin") return withContext(dbCtx(who), fn);
  if (who?.kind === "applicant" && /^[0-9a-f]{64}$/.test(who.tokenHash)) return withContext({ role: "applicant", tokenHash: who.tokenHash }, fn);
  throw new NotFoundError();
}
const uid = (who: Who) => (who.kind === "applicant" ? null : who.userId);
const logAs = (who: Who) => (who.kind === "applicant" ? ({ kind: "system", role: "applicant", userId: null } as const) : who);

export const EDITABLE = ["draft", "needs_info"] as const;
const isEditable = (s: string) => (EDITABLE as readonly string[]).includes(s);

async function loadOwn(tx: Tx, id: string) {
  const [s] = await tx.select().from(intakeSubmissions).where(eq(intakeSubmissions.id, uuidOrThrow(id)));
  if (!s) throw new NotFoundError();
  return s;
}

async function completedFiles(tx: Tx, submissionIds: string[]) {
  if (!submissionIds.length) return [];
  return tx
    .select({
      id: intakeFiles.id,
      submissionId: intakeFiles.submissionId,
      questionKey: intakeFiles.questionKey,
      filename: intakeFiles.filename,
      sizeBytes: intakeFiles.sizeBytes,
      createdAt: intakeFiles.createdAt,
    })
    .from(intakeFiles)
    .where(and(inArray(intakeFiles.submissionId, submissionIds), isNotNull(intakeFiles.completedAt)))
    .orderBy(asc(intakeFiles.createdAt));
}

export async function getMyPartner(actor: PartnerActor) {
  return asPartner(actor, async (tx) => (await tx.select().from(partners).where(eq(partners.id, actor.partnerId)))[0]);
}

export async function getBandForPartner(actor: Who) {
  return asWho(actor, async (tx) => {
    const [r] = await tx.select().from(prospectSettings).where(eq(prospectSettings.id, 1));
    return { minCr: r?.bandMinCr ?? "50", maxCr: r?.bandMaxCr ?? "250" };
  });
}

export async function listMySubmissions(actor: PartnerActor) {
  return asPartner(actor, async (tx) => {
    const rows = await tx.select().from(intakeSubmissions).orderBy(desc(intakeSubmissions.updatedAt));
    const files = await completedFiles(tx, rows.map((r) => r.id));
    return rows.map((r) => {
      const form = formFor(r);
      const missing = missingItems(form, r.answers as Answers, files.filter((f) => f.submissionId === r.id));
      return { ...r, missingCount: missing.length };
    });
  });
}

export async function createSubmission(actor: PartnerActor, companyName: unknown): Promise<string> {
  const name = String(companyName ?? "").trim().slice(0, 200);
  if (!name) throw new ValidationError("Enter the company's name");
  return asPartner(actor, async (tx) => {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(intakeSubmissions);
    if (n >= 500) throw new ValidationError("You've reached the limit of companies for one partner. Please contact the Before the Bell team.");
    const [row] = await tx
      .insert(intakeSubmissions)
      .values({ partnerId: actor.partnerId, companyName: name, answers: { legal_name: name }, createdBy: actor.userId, updatedBy: actor.userId })
      .returning({ id: intakeSubmissions.id });
    await logActivity(tx, actor, "intake.created", "intake_submission", row.id, { companyName: name });
    return row.id;
  });
}

export async function getMySubmission(actor: Who, id: string) {
  return asWho(actor, async (tx) => {
    const s = await loadOwn(tx, id);
    const files = await completedFiles(tx, [s.id]);
    return { submission: s, files, editable: isEditable(s.status) };
  });
}

/** Autosave. Returns what's still missing so the form can show progress. */
export async function saveAnswers(actor: Who, id: string, raw: unknown) {
  return asWho(actor, async (tx) => {
    const s = await loadOwn(tx, id);
    if (!isEditable(s.status)) throw new ValidationError("This company has been sent to the Before the Bell team and can't be changed now.");
    const form = formFor(s);
    let answers: Answers;
    try {
      answers = cleanAnswers(form, raw);
    } catch (e) {
      if (e instanceof AnswerError) throw new ValidationError(e.message);
      throw e;
    }
    if (JSON.stringify(answers).length > 200_000) throw new ValidationError("This form is too large to save. Please shorten the longest answers.");
    const companyName = typeof answers.legal_name === "string" ? answers.legal_name : s.companyName;
    const cin = typeof answers.cin === "string" ? answers.cin : null;
    const updatedAt = new Date();
    await tx
      .update(intakeSubmissions)
      .set({ answers, companyName, cin, updatedBy: uid(actor), updatedAt })
      .where(eq(intakeSubmissions.id, s.id));
    const files = await completedFiles(tx, [s.id]);
    return { savedAt: updatedAt.toISOString(), missing: missingItems(form, answers, files) };
  });
}

export async function submit(actor: Who, id: string) {
  const result = await asWho(actor, async (tx) => {
    const s = await loadOwn(tx, id);
    if (!isEditable(s.status)) throw new ValidationError("This company has already been sent.");
    const form = formFor(s);
    const files = await completedFiles(tx, [s.id]);
    const problems = submitProblems(form, s.answers as Answers, files);
    if (problems.length) return { ok: false as const, problems };
    await tx
      .update(intakeSubmissions)
      .set({ status: "submitted", submittedAt: new Date(), updatedBy: uid(actor), updatedAt: new Date() })
      .where(eq(intakeSubmissions.id, s.id));
    await logActivity(tx, logAs(actor), s.status === "needs_info" ? "intake.resubmitted" : "intake.submitted", "intake_submission", s.id, {
      companyName: s.companyName,
    });
    return { ok: true as const, problems: [] };
  });
  if (result.ok) await notifyAdminsOfSubmission(id);
  return result;
}

export async function deleteDraft(actor: PartnerActor, id: string) {
  return asPartner(actor, async (tx) => {
    const s = await loadOwn(tx, id);
    if (s.status !== "draft") throw new ValidationError("Only a draft that hasn't been sent can be deleted.");
    await tx.delete(intakeSubmissions).where(eq(intakeSubmissions.id, s.id));
    await logActivity(tx, actor, "intake.deleted", "intake_submission", s.id, { companyName: s.companyName });
  });
}

// ---------- files ----------

export async function startUpload(actor: Who, submissionId: string, input: { questionKey: unknown; filename: unknown; size: unknown }) {
  const filename = safeFilename(String(input.filename ?? ""));
  const size = Number(input.size);
  if (!allowedName(filename)) throw new ValidationError("Use PDF, Excel, Word, CSV, PNG, JPEG or ZIP files");
  if (!Number.isInteger(size) || size <= 0) throw new ValidationError("The file is empty");
  if (size > INTAKE_MAX_BYTES) throw new ValidationError("Files can be up to 50 MB. Please split or compress larger ones.");
  return asWho(actor, async (tx) => {
    const s = await loadOwn(tx, submissionId);
    if (!isEditable(s.status)) throw new ValidationError("This company has been sent and can't be changed now.");
    const q = findQuestion(formFor(s), String(input.questionKey ?? ""));
    if (!q || q.field.type !== "file") throw new ValidationError("Unknown document");
    if (!q.field.multiple) {
      // Single-file questions: a new upload replaces the old one.
      await tx.delete(intakeFiles).where(and(eq(intakeFiles.submissionId, s.id), eq(intakeFiles.questionKey, q.key)));
    }
    const partCount = partCountFor(size);
    const [row] = await tx
      .insert(intakeFiles)
      .values({ submissionId: s.id, questionKey: q.key, filename, sizeBytes: size, parts: Array<string>(partCount).fill(""), partCount, uploadedBy: uid(actor) })
      .returning({ id: intakeFiles.id });
    return { fileId: row.id, partCount, partBytes: PART_BYTES };
  });
}

async function loadFile(tx: Tx, fileId: string) {
  const [f] = await tx.select().from(intakeFiles).where(eq(intakeFiles.id, uuidOrThrow(fileId)));
  if (!f) throw new NotFoundError();
  return f;
}

export async function putPart(actor: Who, fileId: string, index: number, data: Buffer) {
  return asWho(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    if (f.completedAt) throw new ValidationError("This upload is already complete");
    if (!Number.isInteger(index) || index < 0 || index >= f.partCount) throw new ValidationError("Bad part number");
    if (data.length !== expectedPartSize(f.sizeBytes, index)) throw new ValidationError("Part size doesn't match the file");
    const { key } = await putObject(data);
    // Postgres arrays are 1-based. RLS allows the update only while the submission is editable.
    const res = await tx.execute(sql`update intake_files set parts[${index + 1}] = ${key} where id = ${f.id} returning id`);
    if (!res.rows.length) throw new ValidationError("This company has been sent and can't be changed now.");
  });
}

export async function completeUpload(actor: Who, fileId: string) {
  return asWho(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    if (f.completedAt) return { id: f.id };
    if (f.parts.length !== f.partCount || f.parts.some((p) => !p)) throw new ValidationError("Some of the file hasn't arrived. Please upload it again.");
    // Content check on the first bytes: the file must really be what its extension says.
    const first = await getObject(f.parts[0]);
    const contentType = checkFileContent(f.filename, first);
    if (!contentType) {
      await tx.delete(intakeFiles).where(eq(intakeFiles.id, f.id));
      throw new ValidationError(`${f.filename} doesn't look like a valid ${f.filename.split(".").pop()?.toUpperCase()} file`);
    }
    const sha256 = f.partCount === 1 ? createHash("sha256").update(first).digest("hex") : null;
    await tx.update(intakeFiles).set({ completedAt: new Date(), contentType, sha256 }).where(eq(intakeFiles.id, f.id));
    const [s] = await tx.select({ id: intakeSubmissions.id }).from(intakeSubmissions).where(eq(intakeSubmissions.id, f.submissionId));
    await tx.update(intakeSubmissions).set({ updatedAt: new Date(), updatedBy: uid(actor) }).where(eq(intakeSubmissions.id, s.id));
    await logActivity(tx, logAs(actor), "intake.file_uploaded", "intake_submission", f.submissionId, {
      fileId: f.id,
      questionKey: f.questionKey,
      filename: f.filename,
      sizeBytes: f.sizeBytes,
    });
    return { id: f.id, filename: f.filename, sizeBytes: f.sizeBytes, questionKey: f.questionKey };
  });
}

export async function deleteFile(actor: Who, fileId: string) {
  return asWho(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    const res = await tx.delete(intakeFiles).where(eq(intakeFiles.id, f.id)).returning({ id: intakeFiles.id });
    if (!res.length) throw new ValidationError("This company has been sent and its files can't be changed now.");
    await logActivity(tx, logAs(actor), "intake.file_deleted", "intake_submission", f.submissionId, { fileId: f.id, filename: f.filename });
  });
}

/** For downloads: the file's parts, if this partner may see it. */
export async function myFileForDownload(actor: Who, fileId: string) {
  return asWho(actor, async (tx) => {
    const f = await loadFile(tx, fileId);
    if (!f.completedAt) throw new NotFoundError();
    return f;
  });
}
