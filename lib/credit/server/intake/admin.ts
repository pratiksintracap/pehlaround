import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { Tx } from "@/lib/credit/db";
import { documents, intakeFiles, intakeSubmissions, partners, prospects, users } from "@/lib/credit/schema";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { asAdmin, optText, reqText, uuidOrThrow } from "../admin/common";
import { saveBorrower } from "../admin/borrowers";
import { saveFinancials } from "../admin/financials";
import { isQuarterEnd } from "../admin/financials-rules";
import { getBand } from "../admin/prospects";
import { getObject, putObject } from "../storage";
import { notifyApplicantOfRequest, notifyPartnerOfRequest } from "../notify";
import { decrypt } from "../crypto";
import { answersFromRegistry, essentialMissing, formFor, findQuestion, missingItems, reportedAum, requiredCount, type Answers } from "@/lib/credit/intake/definition";

// ---------- partners ----------

export async function listPartners(actor: AdminActor) {
  return asAdmin(actor, async (tx) => {
    const ps = await tx.select().from(partners).orderBy(asc(partners.name));
    const us = await tx
      .select({ id: users.id, name: users.name, email: users.email, partnerId: users.partnerId, disabledAt: users.disabledAt })
      .from(users)
      .where(isNotNull(users.partnerId))
      .orderBy(asc(users.name));
    const counts = await tx
      .select({ partnerId: intakeSubmissions.partnerId, status: intakeSubmissions.status, n: sql<number>`count(*)::int` })
      .from(intakeSubmissions)
      .groupBy(intakeSubmissions.partnerId, intakeSubmissions.status);
    return ps.map((p) => ({
      ...p,
      users: us.filter((u) => u.partnerId === p.id),
      submissions: counts.filter((c) => c.partnerId === p.id).reduce((n, c) => n + (c.status === "draft" ? 0 : c.n), 0),
      drafts: counts.find((c) => c.partnerId === p.id && c.status === "draft")?.n ?? 0,
    }));
  });
}

export async function createPartner(actor: AdminActor, input: { name: unknown; city: unknown; notes: unknown }) {
  const name = reqText(input.name, "Partner name", 200);
  return asAdmin(actor, async (tx) => {
    const [p] = await tx.insert(partners).values({ name, city: optText(input.city, 100), notes: optText(input.notes, 2000) }).returning({ id: partners.id });
    await logActivity(tx, actor, "partner.created", "partner", p.id, { name });
    return p.id;
  });
}

export async function addPartnerUser(actor: AdminActor, partnerId: string, input: { email: unknown; name: unknown }) {
  const pid = uuidOrThrow(partnerId);
  const email = reqText(input.email, "Email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Enter a valid email");
  const name = reqText(input.name, "Name", 200);
  return asAdmin(actor, async (tx) => {
    const [p] = await tx.select({ id: partners.id }).from(partners).where(eq(partners.id, pid));
    if (!p) throw new NotFoundError();
    const [dupe] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (dupe) throw new ValidationError("A user with this email already exists");
    const [u] = await tx.insert(users).values({ email, name, role: "partner", partnerId: pid }).returning({ id: users.id });
    await logActivity(tx, actor, "user.created", "user", u.id, { email, role: "partner", partnerId: pid });
    return u.id;
  });
}

// ---------- submissions ----------

/** Who a submission came from, for the team's screens. */
export function fromLabel(s: { source: string; submitterRole: string | null; submitterName: string | null; agentFirm: string | null }, partnerName: string | null) {
  if (s.source !== "public") return partnerName ?? "Partner";
  return s.submitterRole === "agent"
    ? `Website · agent${s.agentFirm ? `: ${s.agentFirm}` : ""}${s.submitterName ? ` (${s.submitterName})` : ""}`
    : `Website · the company${s.submitterName ? ` (${s.submitterName})` : ""}`;
}

export const SUBMISSION_STATUSES = ["submitted", "needs_info", "in_review", "accepted", "declined", "draft"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

async function filesFor(tx: Tx, ids: string[]) {
  if (!ids.length) return [];
  return tx
    .select({
      id: intakeFiles.id,
      submissionId: intakeFiles.submissionId,
      questionKey: intakeFiles.questionKey,
      filename: intakeFiles.filename,
      sizeBytes: intakeFiles.sizeBytes,
      contentType: intakeFiles.contentType,
      createdAt: intakeFiles.createdAt,
    })
    .from(intakeFiles)
    .where(and(inArray(intakeFiles.submissionId, ids), isNotNull(intakeFiles.completedAt)))
    .orderBy(asc(intakeFiles.createdAt));
}

function inBand(aum: number | null, band: { minCr: string; maxCr: string }) {
  if (aum == null) return null;
  return aum >= Number(band.minCr) && aum <= Number(band.maxCr);
}

export async function listSubmissions(actor: AdminActor, f: { status?: string; partner?: string }) {
  const band = await getBand(actor);
  return asAdmin(actor, async (tx) => {
    const where = [];
    // Drafts are the partner's work in progress; the team sees them only when asked for.
    if (f.status && (SUBMISSION_STATUSES as readonly string[]).includes(f.status)) where.push(eq(intakeSubmissions.status, f.status as SubmissionStatus));
    else where.push(sql`${intakeSubmissions.status} <> 'draft'`);
    if (f.partner && /^[0-9a-f-]{36}$/.test(f.partner)) where.push(eq(intakeSubmissions.partnerId, f.partner));
    const rows = await tx
      .select({ s: intakeSubmissions, partnerName: partners.name })
      .from(intakeSubmissions)
      .leftJoin(partners, eq(partners.id, intakeSubmissions.partnerId))
      .where(and(...where))
      .orderBy(desc(intakeSubmissions.submittedAt), desc(intakeSubmissions.updatedAt));
    const files = await filesFor(tx, rows.map((r) => r.s.id));
    const counts = await tx
      .select({ status: intakeSubmissions.status, n: sql<number>`count(*)::int` })
      .from(intakeSubmissions)
      .groupBy(intakeSubmissions.status);
    const allPartners = await tx.select({ id: partners.id, name: partners.name }).from(partners).orderBy(asc(partners.name));
    return {
      band,
      partners: allPartners,
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<SubmissionStatus, number>>,
      rows: rows.map(({ s, partnerName }) => {
        const a = s.answers as Answers;
        const aum = reportedAum(a);
        return {
          id: s.id,
          companyName: s.companyName,
          cin: s.cin,
          status: s.status,
          partnerName: fromLabel(s, partnerName),
          submittedAt: s.submittedAt,
          updatedAt: s.updatedAt,
          aum,
          inBand: inBand(aum, band),
          amount12m: typeof a.amount_12m === "string" ? a.amount_12m : null,
          state: typeof a.state === "string" ? a.state : null,
          missingCount: missingItems(formFor(s), a, files.filter((x) => x.submissionId === s.id)).length,
          fileCount: files.filter((x) => x.submissionId === s.id).length,
        };
      }),
    };
  });
}

/**
 * The platform team enters a company for a partner (e.g. when the partner emails the files instead of using the
 * form). The submission belongs to that partner exactly as if they had started it.
 */
export async function createSubmissionForPartner(actor: AdminActor, input: { partnerId: unknown; companyName: unknown; cin?: unknown }) {
  const partnerId = uuidOrThrow(String(input.partnerId ?? ""));
  const companyName = String(input.companyName ?? "").trim().slice(0, 200);
  if (!companyName) throw new ValidationError("Enter the company's name");
  const cinRaw = String(input.cin ?? "").toUpperCase().replace(/\s/g, "");
  if (cinRaw && !/^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(cinRaw)) throw new ValidationError("That CIN doesn't look right (21 characters)");
  return asAdmin(actor, async (tx) => {
    const [p] = await tx.select({ id: partners.id, name: partners.name }).from(partners).where(eq(partners.id, partnerId));
    if (!p) throw new ValidationError("Choose a partner");
    const reg = cinRaw ? (await tx.select().from(prospects).where(eq(prospects.cin, cinRaw)).limit(1))[0] : undefined;
    const answers: Answers = { legal_name: companyName, ...(cinRaw ? { cin: cinRaw } : {}), ...(reg ? answersFromRegistry({ state: reg.state, type: reg.classification, layer: reg.layer, rbiRegNo: reg.rbiRegNo }) : {}) };
    answers.legal_name = companyName;
    const [row] = await tx
      .insert(intakeSubmissions)
      .values({ partnerId: p.id, companyName, cin: cinRaw || null, answers, createdBy: actor.userId, updatedBy: actor.userId })
      .returning({ id: intakeSubmissions.id });
    await logActivity(tx, actor, "intake.created", "intake_submission", row.id, { companyName, partner: p.name, enteredBy: "platform" });
    return row.id;
  });
}

/** Forms started on the website and not sent yet: who started them and how far they've got, so the team can follow up. */
export async function listWebsiteStarts(actor: AdminActor) {
  return asAdmin(actor, async (tx) => {
    const rows = await tx
      .select()
      .from(intakeSubmissions)
      .where(and(eq(intakeSubmissions.source, "public"), eq(intakeSubmissions.status, "draft")))
      .orderBy(desc(intakeSubmissions.createdAt))
      .limit(200);
    const files = await filesFor(tx, rows.map((r) => r.id));
    return rows.map((s) => {
      const a = s.answers as Answers;
      const form = formFor(s);
      const mine = files.filter((x) => x.submissionId === s.id);
      const total = requiredCount(form, a);
      const missing = missingItems(form, a, mine).length;
      return {
        id: s.id,
        companyName: s.companyName,
        cin: s.cin,
        submitterName: s.submitterName,
        submitterRole: s.submitterRole,
        agentFirm: s.agentFirm,
        email: s.submitterEmail,
        phone: s.submitterPhone,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        pct: total ? Math.round(((total - missing) / total) * 100) : 0,
        readyToSend: essentialMissing(form, a).length === 0,
        fileCount: mine.length,
      };
    });
  });
}

export async function getSubmission(actor: AdminActor, id: string) {
  const band = await getBand(actor);
  return asAdmin(actor, async (tx) => {
    const [row] = await tx
      .select({ s: intakeSubmissions, partnerName: partners.name })
      .from(intakeSubmissions)
      .leftJoin(partners, eq(partners.id, intakeSubmissions.partnerId))
      .where(eq(intakeSubmissions.id, uuidOrThrow(id)));
    if (!row) throw new NotFoundError();
    const files = await filesFor(tx, [row.s.id]);
    const registry = row.s.cin
      ? (await tx.select().from(prospects).where(eq(prospects.cin, row.s.cin)).limit(1))[0] ?? null
      : null;
    const a = row.s.answers as Answers;
    const aum = reportedAum(a);
    return {
      submission: row.s,
      partnerName: fromLabel(row.s, row.partnerName),
      files,
      registry,
      band,
      aum,
      inBand: inBand(aum, band),
      missing: missingItems(formFor(row.s), a, files),
    };
  });
}

export async function setSubmissionStatus(actor: AdminActor, id: string, status: unknown, note: unknown) {
  const s = String(status);
  if (!["in_review", "needs_info", "declined", "submitted"].includes(s)) throw new ValidationError("Choose a status");
  const teamNote = optText(note, 4000);
  if (s === "needs_info" && !teamNote) throw new ValidationError("Say what's needed: the partner sees this note");
  const sid = uuidOrThrow(id);
  const row0 = await asAdmin(actor, async (tx) => {
    const [row] = await tx.select().from(intakeSubmissions).where(eq(intakeSubmissions.id, sid));
    if (!row) throw new NotFoundError();
    if (row.status === "draft") throw new ValidationError("The partner hasn't sent this yet");
    if (row.status === "accepted") throw new ValidationError("This company is already a borrower");
    await tx
      .update(intakeSubmissions)
      .set({ status: s as SubmissionStatus, teamNote: s === "needs_info" || s === "declined" ? teamNote : row.teamNote, updatedAt: new Date() })
      .where(eq(intakeSubmissions.id, sid));
    await logActivity(tx, actor, "intake.status", "intake_submission", sid, { from: row.status, to: s, note: teamNote });
    return row;
  });
  if (s === "needs_info") {
    if (row0.partnerId) await notifyPartnerOfRequest(row0.partnerId, sid);
    else if (row0.submitterEmail && row0.accessTokenEnc) await notifyApplicantOfRequest(row0.submitterEmail, decrypt(row0.accessTokenEnc));
  }
}

/** Reads a stored file back in one piece (joining its parts). */
export async function readIntakeFile(parts: string[]): Promise<Buffer> {
  const bufs = [];
  for (const p of parts) bufs.push(await getObject(p));
  return Buffer.concat(bufs);
}

export async function fileForAdmin(actor: AdminActor, fileId: string) {
  return asAdmin(actor, async (tx) => {
    const [f] = await tx.select().from(intakeFiles).where(eq(intakeFiles.id, uuidOrThrow(fileId)));
    if (!f || !f.completedAt) throw new NotFoundError();
    return f;
  });
}

const CYCLES = ["monthly", "quarterly", "yearly"];

/**
 * Creates the borrower record from a submission: company details, drawdown cycle, the latest quarter's
 * AUM / GNPA / leverage, and every file as a borrower document. Links the RBI-register prospect if there is one.
 */
export async function acceptAsBorrower(actor: AdminActor, id: string): Promise<string> {
  const d = await getSubmission(actor, id);
  const s = d.submission;
  if (s.borrowerId) return s.borrowerId;
  if (s.status === "draft") throw new ValidationError("The partner hasn't sent this yet");
  const a = s.answers as Answers;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  const form = formFor(s);
  const stateQ = findQuestion(form, "state");
  const stateLabel = stateQ?.field.type === "select" ? stateQ.field.options.find((o) => o.value === str("state"))?.label ?? "" : "";

  const borrowerId = await saveBorrower(actor, null, {
    name: str("legal_name") || s.companyName,
    cin: str("cin"),
    rbiRegistration: str("rbi_cor"),
    city: str("city"),
    state: stateLabel,
    status: "onboarding",
    drawdownCycle: CYCLES.includes(str("cycle")) ? str("cycle") : "",
    notes: `From ${d.submission.source === "public" ? d.partnerName.toLowerCase() : `partner ${d.partnerName}`}'s submission.`,
  });

  // Latest quarter figures, when the quarter end is a real one.
  const fin = (a.fin ?? {}) as Record<string, Record<string, string>>;
  const period = str("latest_period_end");
  const aumCr = fin.aum_on?.latest;
  if (isQuarterEnd(period) && (aumCr || fin.gnpa?.latest)) {
    const nw = Number(fin.net_worth?.latest);
    const debt = Number(fin.borrowings?.latest);
    await saveFinancials(actor, borrowerId, {
      periodEnd: period,
      aum: aumCr ? (Number(aumCr) * 1e7).toFixed(2) : "",
      gnpaPct: fin.gnpa?.latest ?? "",
      leverage: nw > 0 && debt >= 0 ? (debt / nw).toFixed(2) : "",
    }).catch(() => undefined); // figures are a convenience; the team can enter them by hand
  }

  // Copy every file into the borrower's documents, joined into one stored object each.
  for (const f of d.files) {
    const [full] = await asAdmin(actor, (tx) => tx.select().from(intakeFiles).where(eq(intakeFiles.id, f.id)));
    const data = await readIntakeFile(full.parts);
    const { key, sha256 } = await putObject(data);
    const q = findQuestion(form, f.questionKey);
    await asAdmin(actor, (tx) =>
      tx.insert(documents).values({
        borrowerId,
        filename: q ? `${q.label.slice(0, 60)} – ${f.filename}`.slice(0, 200) : f.filename,
        contentType: full.contentType ?? "application/octet-stream",
        sizeBytes: data.length,
        sha256,
        storageKey: key,
        uploadedBy: actor.userId,
      }),
    );
  }

  await asAdmin(actor, async (tx) => {
    await tx.update(intakeSubmissions).set({ status: "accepted", borrowerId, updatedAt: new Date() }).where(eq(intakeSubmissions.id, s.id));
    if (s.cin) {
      await tx
        .update(prospects)
        .set({ borrowerId, status: "onboarded", updatedAt: new Date() })
        .where(and(eq(prospects.cin, s.cin), sql`${prospects.borrowerId} is null`));
    }
    await logActivity(tx, actor, "intake.accepted", "intake_submission", s.id, { borrowerId, files: d.files.length });
  });
  return borrowerId;
}
