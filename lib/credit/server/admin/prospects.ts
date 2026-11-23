import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { withContext, type Tx } from "@/lib/credit/db";
import { outreachEmails, outreachTemplates, prospectSettings, prospects } from "@/lib/credit/schema";
import { BORROWER_LAYERS, NOT_LENDING_TYPES, PRIORITY_GRADES, ratingGrade } from "../prospects/classify";
import { type AdminActor, NotFoundError, ValidationError } from "../actors";
import { logActivity } from "../activity";
import { sendMail } from "../mailer";
import { asAdmin, optText, reqText, uuidOrThrow } from "./common";
import { saveBorrower } from "./borrowers";
import { parseCsv, parseRegistryCsv, type RegistryRow } from "../prospects/registry";
import { renderOutreach, OUTREACH_DEFAULT, type OutreachTemplate } from "../prospects/outreach-render";
import { inSendWindow, SEND_FROM_HOUR, SEND_UNTIL_HOUR } from "../prospects/send-window";

/*
 * Prospects: NBFCs from RBI's public register that aren't on the platform yet, and the team's outreach to them.
 * Platform team only (RLS: admin_all). The scheduled sender runs as the narrow 'outreach' role.
 */

export const PROSPECT_STATUSES = ["new", "contacted", "replied", "interested", "onboarded", "not_a_fit", "do_not_contact"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];
export const PAGE_SIZE = 50;

// ---------- Import ----------

export type ImportResult = { rows: number; added: number; updated: number; skipped: number };

export async function importRegistry(actor: AdminActor, csvText: string): Promise<ImportResult> {
  const { rows, skipped } = parseRegistryCsv(csvText);
  if (rows.length === 0) throw new ValidationError("No NBFC rows found. Use the CSV prepared from RBI's register (it needs at least a name column).");
  return asAdmin(actor, async (tx) => {
    const existing = new Set(
      (await tx.select({ k: prospects.registryKey }).from(prospects).where(inArray(prospects.registryKey, rows.map((r) => r.registryKey)))).map((r) => r.k),
    );
    const now = new Date();
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500).map((r: RegistryRow) => ({ ...r, lastSeenInImportAt: now }));
      await tx
        .insert(prospects)
        .values(batch)
        .onConflictDoUpdate({
          target: prospects.registryKey,
          // Registry columns only: the team's status, contact and notes are never overwritten by an import.
          set: {
            name: sql`excluded.name`,
            cin: sql`excluded.cin`,
            rbiRegNo: sql`excluded.rbi_reg_no`,
            regionalOffice: sql`excluded.regional_office`,
            address: sql`excluded.address`,
            registeredEmail: sql`excluded.registered_email`,
            classification: sql`excluded.classification`,
            layer: sql`excluded.layer`,
            state: sql`excluded.state`,
            lastSeenInImportAt: sql`excluded.last_seen_in_import_at`,
            updatedAt: now,
          },
        });
    }
    const updated = rows.filter((r) => existing.has(r.registryKey)).length;
    const result = { rows: rows.length, added: rows.length - updated, updated, skipped };
    await logActivity(tx, actor, "prospects.imported", "prospects", null, result);
    return result;
  });
}

// ---------- Band setting ----------

export type Band = { minCr: string; maxCr: string };

async function loadBand(tx: Tx): Promise<Band> {
  const [r] = await tx.select().from(prospectSettings).where(eq(prospectSettings.id, 1));
  return { minCr: r?.bandMinCr ?? "50", maxCr: r?.bandMaxCr ?? "250" };
}

const CRORE_RE = /^\d{1,9}(\.\d{1,2})?$/;
function crore(v: unknown, field: string, required = false): string | null {
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (!s) {
    if (required) throw new ValidationError(`${field} is required`);
    return null;
  }
  if (!CRORE_RE.test(s)) throw new ValidationError(`${field}: enter an amount in ₹ crore, e.g. 120 or 87.5`);
  return s;
}

export async function saveBand(actor: AdminActor, input: { minCr: unknown; maxCr: unknown }) {
  const minCr = crore(input.minCr, "Band from", true)!;
  const maxCr = crore(input.maxCr, "Band to", true)!;
  if (Number(minCr) > Number(maxCr)) throw new ValidationError("The band's lower end must be below its upper end");
  return asAdmin(actor, async (tx) => {
    await tx
      .insert(prospectSettings)
      .values({ id: 1, bandMinCr: minCr, bandMaxCr: maxCr, updatedBy: actor.userId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: prospectSettings.id, set: { bandMinCr: minCr, bandMaxCr: maxCr, updatedBy: actor.userId, updatedAt: new Date() } });
    await logActivity(tx, actor, "prospects.band_saved", "prospect_settings", "1", { minCr, maxCr });
  });
}

// ---------- List / view ----------

export const SORTS = {
  name: { label: "Name", col: prospects.name },
  aum: { label: "AUM", col: prospects.aumCr },
  loanBook: { label: "Loan book", col: prospects.loanBookCr },
  state: { label: "State", col: prospects.state },
  status: { label: "Status", col: prospects.status },
  lastContacted: { label: "Last contacted", col: prospects.lastContactedAt },
  followUp: { label: "Follow-up", col: prospects.nextFollowUp },
  rating: { label: "Rating", col: prospects.ratingDate },
  priority: { label: "Priority", col: null },
} as const;
export type SortKey = keyof typeof SORTS;

export type ProspectFilters = {
  q?: string;
  view?: string; // "borrowers" (default): Base layer, lending types | "all"
  size?: string; // "band" | "outside" | "unknown" | "" (any)
  layer?: string;
  classification?: string;
  state?: string;
  office?: string;
  status?: string;
  followUp?: string; // "due"
  hasEmail?: string; // "1"
  hasContact?: string; // "1"
  rated?: string; // "yes" | "no" | "watch" (BBB or below, or negative / not cooperating)
  sort?: string;
  dir?: string;
  page?: number;
};

/** Size used for the band: AUM when known, otherwise the loan book. */
const sizeExpr = sql`coalesce(${prospects.aumCr}, ${prospects.loanBookCr})`;

/** priorityScore() in classify.ts, in SQL, for sorting. Keep the two in step. */
function prioritySql(band: Band) {
  const grades = sql.join(PRIORITY_GRADES.map((g) => sql`${g}`), sql`, `);
  return sql`(case when ${prospects.status} in ('onboarded', 'not_a_fit', 'do_not_contact') then 0 else
    (case when ${sizeExpr} is null then 15 when ${sizeExpr} between ${band.minCr} and ${band.maxCr} then 40 else 0 end)
    + (case when ${prospects.rating} is null then 10 when ${prospects.ratingGrade} in (${grades}) then 20 else 5 end)
    + (case when coalesce(${prospects.ratingOutlook}, '') ~* '(negative|inc|not cooperating)' then 10 else 0 end)
    + (case when coalesce(cardinality(${prospects.lenders}), 0) >= 3 then 15 when coalesce(cardinality(${prospects.lenders}), 0) >= 1 then 10 else 0 end)
    + (case when ${prospects.contactName} is not null then 10 when coalesce(${prospects.contactEmail}, ${prospects.registeredEmail}) is not null then 5 else 0 end)
  end)`;
}

function whereFor(f: ProspectFilters, band: Band): SQL | undefined {
  const parts: SQL[] = [];
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
    parts.push(or(ilike(prospects.name, like), ilike(prospects.cin, like), ilike(prospects.contactName, like), ilike(prospects.contactEmail, like))!);
  }
  if ((f.view ?? "borrowers") === "borrowers") {
    parts.push(inArray(prospects.layer, [...BORROWER_LAYERS]));
    parts.push(sql`coalesce(${prospects.classification}, '') not in (${sql.join(NOT_LENDING_TYPES.map((t) => sql`${t}`), sql`, `)})`);
  }
  if (f.size === "band") parts.push(sql`${sizeExpr} between ${band.minCr} and ${band.maxCr}`);
  if (f.size === "outside") parts.push(sql`${sizeExpr} is not null and ${sizeExpr} not between ${band.minCr} and ${band.maxCr}`);
  if (f.size === "unknown") parts.push(sql`${sizeExpr} is null`);
  if (f.layer) parts.push(eq(prospects.layer, f.layer));
  if (f.classification) parts.push(eq(prospects.classification, f.classification));
  if (f.state) parts.push(eq(prospects.state, f.state));
  if (f.office) parts.push(eq(prospects.regionalOffice, f.office));
  if (f.status && (PROSPECT_STATUSES as readonly string[]).includes(f.status)) parts.push(eq(prospects.status, f.status as ProspectStatus));
  if (f.followUp === "due") parts.push(lte(prospects.nextFollowUp, new Date().toISOString().slice(0, 10)));
  if (f.hasEmail === "1") parts.push(sql`coalesce(${prospects.contactEmail}, ${prospects.registeredEmail}) is not null`);
  if (f.hasContact === "1") parts.push(sql`${prospects.contactName} is not null`);
  if (f.rated === "yes") parts.push(sql`${prospects.rating} is not null`);
  if (f.rated === "no") parts.push(sql`${prospects.rating} is null`);
  if (f.rated === "watch")
    parts.push(
      sql`(${prospects.ratingGrade} in (${sql.join(PRIORITY_GRADES.map((g) => sql`${g}`), sql`, `)}) or coalesce(${prospects.ratingOutlook}, '') ~* '(negative|inc|not cooperating)')`,
    );
  return parts.length ? and(...parts) : undefined;
}

export async function listProspects(actor: AdminActor, f: ProspectFilters) {
  const page = Math.max(1, Math.floor(f.page ?? 1));
  return asAdmin(actor, async (tx) => {
    const band = await loadBand(tx);
    const where = whereFor(f, band);
    const sortKey: SortKey = f.sort && f.sort in SORTS ? (f.sort as SortKey) : "name";
    const dir = f.dir === "desc" ? "desc" : "asc";
    const col = SORTS[sortKey].col ?? prioritySql(band);
    const order = dir === "desc" ? sql`${col} desc nulls last` : sql`${col} asc nulls last`;
    const [{ n }] = await tx.select({ n: count() }).from(prospects).where(where);
    const rows = await tx
      .select({
        id: prospects.id,
        name: prospects.name,
        layer: prospects.layer,
        classification: prospects.classification,
        state: prospects.state,
        regionalOffice: prospects.regionalOffice,
        status: prospects.status,
        contactName: prospects.contactName,
        contactEmail: prospects.contactEmail,
        registeredEmail: prospects.registeredEmail,
        loanBookCr: prospects.loanBookCr,
        aumCr: prospects.aumCr,
        lastContactedAt: prospects.lastContactedAt,
        nextFollowUp: prospects.nextFollowUp,
        rating: prospects.rating,
        ratingOutlook: prospects.ratingOutlook,
        ratingDate: prospects.ratingDate,
        lenderCount: sql<number>`coalesce(cardinality(${prospects.lenders}), 0)`,
        priority: sql<number>`${prioritySql(band)}`,
      })
      .from(prospects)
      .where(where)
      .orderBy(order, asc(prospects.name))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);
    const facet = async (c: typeof prospects.layer | typeof prospects.classification | typeof prospects.state | typeof prospects.regionalOffice) =>
      (await tx.select({ v: sql<string | null>`${c}`, n: count() }).from(prospects).groupBy(c).orderBy(asc(c))).filter((r) => r.v) as { v: string; n: number }[];
    const statusCounts = await tx.select({ v: prospects.status, n: count() }).from(prospects).where(whereFor({ view: f.view }, band)).groupBy(prospects.status);
    const sizeCounts = await tx
      .select({
        band: sql<number>`count(*) filter (where ${sizeExpr} between ${band.minCr} and ${band.maxCr})::int`,
        outside: sql<number>`count(*) filter (where ${sizeExpr} is not null and ${sizeExpr} not between ${band.minCr} and ${band.maxCr})::int`,
        unknown: sql<number>`count(*) filter (where ${sizeExpr} is null)::int`,
        rated: sql<number>`count(*) filter (where ${prospects.rating} is not null)::int`,
      })
      .from(prospects)
      .where(whereFor({ view: f.view }, band));
    return {
      rows,
      total: n,
      page,
      pages: Math.max(1, Math.ceil(n / PAGE_SIZE)),
      band,
      sort: sortKey,
      dir,
      facets: {
        layers: await facet(prospects.layer),
        classifications: await facet(prospects.classification),
        states: await facet(prospects.state),
        offices: await facet(prospects.regionalOffice),
        statuses: Object.fromEntries(statusCounts.map((r) => [r.v, r.n])) as Record<string, number>,
        sizes: sizeCounts[0],
      },
    };
  });
}

export async function getBand(actor: AdminActor) {
  return asAdmin(actor, (tx) => loadBand(tx));
}

export async function getProspect(actor: AdminActor, id: string) {
  const pid = uuidOrThrow(id);
  return asAdmin(actor, async (tx) => {
    const [p] = await tx.select().from(prospects).where(eq(prospects.id, pid));
    if (!p) throw new NotFoundError();
    const emails = await tx.select().from(outreachEmails).where(eq(outreachEmails.prospectId, pid)).orderBy(desc(outreachEmails.createdAt));
    const template = await loadTemplate(tx);
    const band = await loadBand(tx);
    return { prospect: p, emails, template, band };
  });
}

// ---------- Team fields ----------

export type ProspectUpdate = {
  status?: unknown;
  contactName?: unknown;
  contactRole?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  notes?: unknown;
  nextFollowUp?: unknown;
  loanBookCr?: unknown;
  aumCr?: unknown;
  sizeAsOf?: unknown;
  sizeSource?: unknown;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateProspect(actor: AdminActor, id: string, input: ProspectUpdate) {
  const pid = uuidOrThrow(id);
  const status = String(input.status ?? "");
  if (!(PROSPECT_STATUSES as readonly string[]).includes(status)) throw new ValidationError("Choose a status");
  const contactEmail = optText(input.contactEmail, 200)?.toLowerCase() ?? null;
  if (contactEmail && !EMAIL_RE.test(contactEmail)) throw new ValidationError("Enter a valid contact email");
  const follow = optText(input.nextFollowUp, 10);
  if (follow && !/^\d{4}-\d{2}-\d{2}$/.test(follow)) throw new ValidationError("Follow-up date must be a date");
  const sizeAsOf = optText(input.sizeAsOf, 10);
  if (sizeAsOf && !/^\d{4}-\d{2}-\d{2}$/.test(sizeAsOf)) throw new ValidationError("'Size as of' must be a date");
  const v = {
    status: status as ProspectStatus,
    contactName: optText(input.contactName, 200),
    contactRole: optText(input.contactRole, 200),
    contactEmail,
    contactPhone: optText(input.contactPhone, 40),
    notes: optText(input.notes, 5000),
    nextFollowUp: follow,
    loanBookCr: crore(input.loanBookCr, "Loan book"),
    aumCr: crore(input.aumCr, "AUM"),
    sizeAsOf: sizeAsOf,
    sizeSource: optText(input.sizeSource, 300),
    updatedAt: new Date(),
  };
  return asAdmin(actor, async (tx) => {
    const [before] = await tx.select().from(prospects).where(eq(prospects.id, pid));
    if (!before) throw new NotFoundError();
    await tx.update(prospects).set(v).where(eq(prospects.id, pid));
    await logActivity(tx, actor, "prospect.updated", "prospect", pid, {
      before: { status: before.status, contactName: before.contactName, contactEmail: before.contactEmail, loanBookCr: before.loanBookCr, aumCr: before.aumCr },
      after: { status: v.status, contactName: v.contactName, contactEmail: v.contactEmail, loanBookCr: v.loanBookCr, aumCr: v.aumCr },
    });
  });
}

/** Creates the borrower record for a prospect that has agreed to come on board, and links the two. */
export async function convertToBorrower(actor: AdminActor, id: string): Promise<string> {
  const pid = uuidOrThrow(id);
  const p = await asAdmin(actor, async (tx) => (await tx.select().from(prospects).where(eq(prospects.id, pid)))[0]);
  if (!p) throw new NotFoundError();
  if (p.borrowerId) return p.borrowerId;
  const borrowerId = await saveBorrower(actor, null, {
    name: p.name,
    cin: p.cin ?? "",
    rbiRegistration: p.rbiRegNo ?? "",
    status: "onboarding",
    notes: p.notes ?? "",
  });
  await asAdmin(actor, async (tx) => {
    await tx.update(prospects).set({ borrowerId, status: "onboarded", updatedAt: new Date() }).where(eq(prospects.id, pid));
    await logActivity(tx, actor, "prospect.converted", "prospect", pid, { borrowerId });
  });
  return borrowerId;
}

// ---------- Template ----------

async function loadTemplate(tx: Tx): Promise<OutreachTemplate & { reviewed: boolean; updatedAt: Date | null }> {
  const [t] = await tx.select().from(outreachTemplates).where(eq(outreachTemplates.name, "default"));
  if (!t) return { ...OUTREACH_DEFAULT, reviewed: false, updatedAt: null };
  // A template counts as reviewed once someone on the team has saved it.
  return { subject: t.subject, body: t.body, reviewed: Boolean(t.updatedBy), updatedAt: t.updatedAt };
}

export async function getTemplate(actor: AdminActor) {
  return asAdmin(actor, (tx) => loadTemplate(tx));
}

export async function saveTemplate(actor: AdminActor, input: { subject: unknown; body: unknown }) {
  const subject = reqText(input.subject, "Subject", 200);
  const body = reqText(input.body, "Message", 8000);
  if (!body.includes("{{company}}") && !body.includes("{{contact_name}}")) {
    throw new ValidationError("Use {{company}} or {{contact_name}} in the message so each email is addressed to the NBFC");
  }
  return asAdmin(actor, async (tx) => {
    await tx
      .insert(outreachTemplates)
      .values({ name: "default", subject, body, updatedBy: actor.userId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: outreachTemplates.name, set: { subject, body, updatedBy: actor.userId, updatedAt: new Date() } });
    await logActivity(tx, actor, "outreach.template_saved", "outreach_template", "default", { subject });
  });
}

// ---------- Sending ----------

/** Where outreach is sent from. Replies go to the sender's own email (reply-to). */
export const OUTREACH_FROM_ADDRESS = process.env.OUTREACH_FROM_ADDRESS || "desk@beforethebell.in";

/**
 * Sends one outreach email to one prospect, now, because a person clicked Send. Nothing is ever sent
 * automatically: there is no queue and no scheduled job. Sending is only allowed between 09:00 and 20:00 IST.
 */
export async function sendOutreach(
  actor: AdminActor,
  prospectId: string,
  input: { to: unknown; subject: unknown; body: unknown },
): Promise<void> {
  const pid = uuidOrThrow(prospectId);
  const to = String(input.to ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(to)) throw new ValidationError("Enter the email address to send to");
  const subject = reqText(input.subject, "Subject", 200);
  const bodyText = reqText(input.body, "Message", 8000);
  if (/\{\{\s*\w+\s*\}\}/.test(subject + bodyText)) throw new ValidationError("Fill in or remove the remaining {{placeholders}} before sending");
  const now = new Date();
  if (!inSendWindow(now)) {
    throw new ValidationError(`Outreach can be sent between ${SEND_FROM_HOUR}:00 and ${SEND_UNTIL_HOUR}:00 IST. Your draft is still here; send it then.`);
  }

  const row = await asAdmin(actor, async (tx) => {
    const template = await loadTemplate(tx);
    if (!template.reviewed) throw new ValidationError("Review and save the outreach template once before the first send (Prospects → Outreach template).");
    const [p] = await tx.select().from(prospects).where(eq(prospects.id, pid));
    if (!p) throw new NotFoundError();
    if (p.status === "do_not_contact") throw new ValidationError("This NBFC is marked do not contact");
    const recent = await tx
      .select({ id: outreachEmails.id })
      .from(outreachEmails)
      .where(
        and(
          eq(outreachEmails.prospectId, pid),
          inArray(outreachEmails.status, ["sending", "sent"]),
          gte(outreachEmails.createdAt, new Date(now.getTime() - 3 * 24 * 3600 * 1000)),
        ),
      );
    if (recent.length) throw new ValidationError("An email to this NBFC was sent in the last 3 days");
    const [r] = await tx
      .insert(outreachEmails)
      .values({
        prospectId: pid,
        toEmail: to,
        subject,
        bodyText,
        fromName: actor.name,
        replyTo: actor.email,
        status: "sending",
        scheduledFor: now,
        createdBy: actor.userId,
      })
      .returning();
    await logActivity(tx, actor, "outreach.sending", "prospect", pid, { to, subject });
    return r;
  });

  await deliver(actor, row);
}

type EmailRow = typeof outreachEmails.$inferSelect;

async function deliver(actor: AdminActor, row: EmailRow) {
  const rendered = renderOutreach(row.bodyText, { senderName: row.fromName, replyTo: row.replyTo });
  try {
    await sendMail(row.toEmail, row.subject, rendered.text, {
      html: rendered.html,
      fromName: `${row.fromName} | Before the Bell`,
      fromAddress: OUTREACH_FROM_ADDRESS,
      replyTo: row.replyTo,
    });
    await asAdmin(actor, async (tx) => {
      await tx.update(outreachEmails).set({ status: "sent", sentAt: new Date(), error: null }).where(eq(outreachEmails.id, row.id));
      await tx
        .update(prospects)
        .set({
          lastContactedAt: new Date(),
          status: sql`case when ${prospects.status} = 'new' then 'contacted'::prospect_status else ${prospects.status} end`,
          updatedAt: new Date(),
        })
        .where(eq(prospects.id, row.prospectId));
      await logActivity(tx, actor, "outreach.sent", "prospect", row.prospectId, { to: row.toEmail, subject: row.subject });
    });
  } catch (e) {
    console.error("[outreach] send failed", e);
    const msg = e instanceof Error ? e.message.slice(0, 300) : "Send failed";
    await asAdmin(actor, (tx) => tx.update(outreachEmails).set({ status: "failed", error: msg }).where(eq(outreachEmails.id, row.id)));
    throw new ValidationError("The email couldn't be sent. It's marked failed on this prospect; try again shortly.");
  }
}

// ---------- Research (ratings, lenders, filings) ----------

export type ResearchInput = Record<string, unknown>;

const PCT_RE = /^-?\d{1,4}(\.\d{1,2})?$/;
function pct(v: unknown, field: string): string | null {
  const s = String(v ?? "").replace(/%/g, "").trim();
  if (!s) return null;
  if (!PCT_RE.test(s) || Number(s) < 0 || Number(s) > 100) throw new ValidationError(`${field}: enter a percentage, e.g. 2.4`);
  return s;
}
function isoDate(v: unknown, field: string): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ValidationError(`${field}: use a date (YYYY-MM-DD)`);
  return s;
}
function url(v: unknown, field: string): string | null {
  const s = optText(v, 1000);
  if (!s) return null;
  if (!/^https?:\/\/\S+$/i.test(s)) throw new ValidationError(`${field}: enter a full link starting with https://`);
  return s;
}
function lenderList(v: unknown): string[] | null {
  const arr = (Array.isArray(v) ? v.map(String) : String(v ?? "").split(/[;\n]/)).map((x) => x.trim()).filter(Boolean).slice(0, 60);
  return arr.length ? [...new Set(arr.map((x) => x.slice(0, 200)))] : null;
}

function parseResearch(input: ResearchInput) {
  const rating = optText(input.rating, 100);
  return {
    segment: optText(input.segment, 100),
    website: url(input.website, "Website"),
    ratingAgency: optText(input.ratingAgency, 100),
    rating,
    ratingGrade: ratingGrade(rating),
    ratingOutlook: optText(input.ratingOutlook, 100),
    ratingDate: isoDate(input.ratingDate, "Rating date"),
    ratingUrl: url(input.ratingUrl, "Rating report link"),
    gnpaPct: pct(input.gnpaPct, "Gross NPA"),
    crarPct: pct(input.crarPct, "CRAR"),
    bankFacilitiesCr: crore(input.bankFacilitiesCr, "Rated facilities"),
    lenders: lenderList(input.lenders),
    chargesTotalCr: crore(input.chargesTotalCr, "Registered charges"),
    directors: optText(input.directors, 2000),
    lastFilingOn: isoDate(input.lastFilingOn, "Last filing"),
    researchNotes: optText(input.researchNotes, 4000),
  };
}

export async function updateProspectResearch(actor: AdminActor, id: string, input: ResearchInput) {
  const pid = uuidOrThrow(id);
  const v = parseResearch(input);
  return asAdmin(actor, async (tx) => {
    const [before] = await tx.select().from(prospects).where(eq(prospects.id, pid));
    if (!before) throw new NotFoundError();
    await tx.update(prospects).set({ ...v, researchedAt: new Date(), updatedAt: new Date() }).where(eq(prospects.id, pid));
    await logActivity(tx, actor, "prospect.research_updated", "prospect", pid, { rating: v.rating, lenders: v.lenders?.length ?? 0 });
  });
}

/** Name key for matching research rows to RBI register names: case, punctuation and Pvt/Ltd spellings ignored. */
export function nameKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/\bPRIVATE\b/g, "PVT")
    .replace(/\bLIMITED\b/g, "LTD")
    .replace(/\bTHE\b/g, "")
    .replace(/[^A-Z0-9]+/g, "");
}

export type ResearchImportResult = { rows: number; matched: number; unmatched: { name: string; reason: string }[] };

/**
 * Applies a research CSV (one row per NBFC, columns as in the research template) to prospects, matching by CIN,
 * then by name. Research fields are replaced; AUM and loan book are set when the prospect has none yet or the
 * row's figure is more recent than the one on file.
 */
export async function importResearch(actor: AdminActor, csvText: string): Promise<ResearchImportResult> {
  const table = parseCsv(csvText);
  if (table.length < 2) throw new ValidationError("Paste the research CSV, including its header row.");
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (r: string[], k: string) => {
    const i = head.indexOf(k);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  if (!head.includes("name")) throw new ValidationError("The CSV needs a 'name' column.");
  const rows = table.slice(1).filter((r) => r.some((c) => c.trim()));
  if (rows.length > 2000) throw new ValidationError("Up to 2,000 rows at a time, please.");
  const result: ResearchImportResult = { rows: rows.length, matched: 0, unmatched: [] };
  return asAdmin(actor, async (tx) => {
    const all = await tx.select({ id: prospects.id, name: prospects.name, cin: prospects.cin, aumCr: prospects.aumCr, sizeAsOf: prospects.sizeAsOf }).from(prospects);
    const byCin = new Map(all.filter((p) => p.cin).map((p) => [p.cin!.toUpperCase(), p]));
    const byName = new Map<string, typeof all>();
    for (const p of all) {
      const k = nameKey(p.name);
      byName.set(k, [...(byName.get(k) ?? []), p]);
    }
    for (const r of rows) {
      const name = col(r, "name");
      const cin = col(r, "cin").toUpperCase();
      let p = cin ? byCin.get(cin) : undefined;
      if (!p) {
        const hits = byName.get(nameKey(name)) ?? [];
        if (hits.length === 1) p = hits[0];
        else {
          result.unmatched.push({ name: name || "(no name)", reason: hits.length ? "more than one NBFC with this name" : "not in the RBI list" });
          continue;
        }
      }
      let v;
      try {
        v = parseResearch({
          segment: col(r, "type"),
          ratingAgency: col(r, "agency"),
          rating: col(r, "rating"),
          ratingOutlook: col(r, "outlook"),
          ratingDate: col(r, "rating_date"),
          ratingUrl: col(r, "source_url"),
          gnpaPct: col(r, "gnpa_pct"),
          crarPct: col(r, "crar_pct"),
          bankFacilitiesCr: col(r, "bank_facilities_cr"),
          lenders: col(r, "lenders"),
          chargesTotalCr: col(r, "charges_total_cr"),
          directors: col(r, "directors"),
          lastFilingOn: col(r, "last_filing_on"),
          website: col(r, "website"),
          researchNotes: col(r, "notes"),
        });
      } catch (e) {
        result.unmatched.push({ name, reason: (e as Error).message });
        continue;
      }
      const aum = col(r, "aum_cr").replace(/,/g, "");
      const asOf = col(r, "aum_as_of");
      const loanBook = col(r, "loan_book_cr").replace(/,/g, "");
      const newer = !p.aumCr || !p.sizeAsOf || (asOf && asOf > p.sizeAsOf);
      const size =
        newer && (aum || loanBook)
          ? {
              ...(aum && /^\d{1,9}(\.\d{1,2})?$/.test(aum) ? { aumCr: aum } : {}),
              ...(loanBook && /^\d{1,9}(\.\d{1,2})?$/.test(loanBook) ? { loanBookCr: loanBook } : {}),
              sizeAsOf: /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? asOf : null,
              sizeSource: [v.ratingAgency, "rating report", v.ratingDate].filter(Boolean).join(" ").slice(0, 300),
            }
          : {};
      // Keep values the row leaves blank.
      const set = Object.fromEntries(Object.entries(v).filter(([, x]) => x != null));
      await tx.update(prospects).set({ ...set, ...size, researchedAt: new Date(), updatedAt: new Date() }).where(eq(prospects.id, p.id));
      result.matched++;
    }
    await logActivity(tx, actor, "prospects.research_imported", "prospect", null, { rows: result.rows, matched: result.matched, unmatched: result.unmatched.length });
    return result;
  });
}
