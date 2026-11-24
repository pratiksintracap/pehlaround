import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects, tasks, users } from "@/db/schema";
import { istDay } from "@/lib/stages";
import { emailReady, esc, sendRaw } from "@/lib/email";
import { DESK_EMAIL, SITE_URL } from "@/lib/site";

// Deal sourcing. The scheduled assistant finds companies that may suit the desk (pre-IPO equity, a debt need, or both),
// logs them here, and writes an outreach email for each. The desk reviews the email on the Sourcing page and approves
// it; only then does the site send it, from the desk address, and only in working hours (an approval at night waits for
// 9 AM). Only when a company replies with interest does the banker get a call task. Nothing here is shown outside the console.

export const PROSPECT_STATUS = [
  { id: "new", label: "Found", hint: "Logged; no outreach draft yet" },
  { id: "drafted", label: "Draft ready", hint: "The email is written and waits for the desk to review and approve it" },
  { id: "approved", label: "Approved", hint: "Approved outside sending hours; it goes at 9 AM on the next working day" },
  { id: "emailed", label: "Emailed", hint: "Sent; waiting for a reply" },
  { id: "interested", label: "Interested", hint: "Replied with interest; call task made" },
  { id: "added", label: "On the pipeline", hint: "Made into a deal" },
  { id: "declined", label: "Not interested", hint: "The company said no, or never replied after a follow-up" },
  { id: "passed", label: "Passed", hint: "The desk decided it is not a fit" },
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUS)[number]["id"];
export const asProspectStatus = (v: string): ProspectStatus | null => (PROSPECT_STATUS.some((x) => x.id === v) ? (v as ProspectStatus) : null);
export const prospectLabel = (v: string) => PROSPECT_STATUS.find((x) => x.id === v)?.label ?? v;
export const KINDS = ["equity", "debt", "both"] as const;

/** One row per company: lower case, legal endings and punctuation dropped. */
export function normCompany(name: string) {
  return name.toLowerCase().replace(/&/g, " and ")
    .replace(/\b(private|pvt|limited|ltd|llp|india|the|co|company|corporation|corp|inc)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Next working day (Monday to Friday) after an IST date, as YYYY-MM-DD. */
export function nextWorkingDay(day = istDay(), plus = 1) {
  const d = new Date(`${day}T00:00:00Z`);
  let left = plus;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--; }
  return d.toISOString().slice(0, 10);
}

const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const num = (v: unknown) => { const x = Number(String(v ?? "").replace(/[,₹\s]/g, "")); return Number.isFinite(x) && String(v ?? "").trim() !== "" ? x : null; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ASSISTANT = "Claude (assistant)";
/** An email body as plain text: no markup, the sign-off dropped (the site adds the desk's own). */
const cleanBody = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n")
  .replace(/\n*(regards|best regards|warm regards|sincerely|thanks and regards),?\s*\n[\s\S]*$/i, "").trim().slice(0, 3000);

/** The banker who takes the calls: the desk member named in the request, else the first one called Puneet. */
async function caller(name?: string) {
  const db = await getDb();
  const want = s(name, 80).toLowerCase() || "puneet";
  const [u] = await db.select({ id: users.id, name: users.name }).from(users)
    .where(and(inArray(users.role, ["admin", "analyst"]), sql`lower(${users.name}) like ${"%" + want + "%"}`));
  return u ?? null;
}

export async function prospectNames() {
  const db = await getDb();
  return db.select({ company: prospects.company, norm: prospects.norm, status: prospects.status, contactEmail: prospects.contactEmail,
    emailSubject: prospects.emailSubject, draftedAt: prospects.draftedAt, emailedAt: prospects.emailedAt, repliedAt: prospects.repliedAt,
    sends: prospects.sends, website: prospects.website, kind: prospects.kind, hasEmail: sql<boolean>`${prospects.emailBody} is not null` }).from(prospects);
}

/** Adds a prospect the assistant (or the desk) found. Refuses a company that is already on the list. */
export async function addProspect(b: Record<string, unknown>, foundBy: string) {
  const company = s(b.company, 200);
  const norm = normCompany(company);
  if (!company || !norm) return { error: "A company name is needed." };
  const db = await getDb();
  const [dup] = await db.select({ id: prospects.id, status: prospects.status }).from(prospects).where(eq(prospects.norm, norm));
  if (dup) return { exists: true, id: dup.id, status: dup.status };
  const kind = (KINDS as readonly string[]).includes(s(b.kind, 10)) ? s(b.kind, 10) : "equity";
  const list = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => s(x, 300)).filter(Boolean).slice(0, 12);
  const sources = (Array.isArray(b.sources) ? b.sources : []).map((x) => ({ title: s((x as { title?: string })?.title, 200), url: s((x as { url?: string })?.url, 500) }))
    .filter((x) => /^https:\/\/\S+$/.test(x.url)).slice(0, 8);
  const email = s(b.contactEmail, 200).toLowerCase();
  const [row] = await db.insert(prospects).values({
    company, norm, cin: s(b.cin, 30) || null, city: s(b.city, 80) || null, sector: s(b.sector, 120) || null, fy: s(b.fy, 10) || null,
    revenueCr: num(b.revenueCr), patCr: num(b.patCr), growthPct: num(b.growthPct), rating: s(b.rating, 200) || null, kind,
    why: s(b.why, 1500) || null, signals: list(b.signals), sources, foundBy,
    contactName: s(b.contactName, 120) || null, contactRole: s(b.contactRole, 120) || null, contactEmail: EMAIL.test(email) ? email : null,
    website: /^https?:\/\/\S+$/.test(s(b.website, 300)) ? s(b.website, 300) : null,
  }).returning({ id: prospects.id });
  return { ok: true, id: row.id };
}

/**
 * Moves a prospect along. When it becomes "interested", the banker gets a call task due the next working day (once).
 * { company, status?, note?, contactEmail?, contactName?, emailSubject?, assignee? }
 */
export async function updateProspect(b: Record<string, unknown>, by: string) {
  const db = await getDb();
  const name = s(b.company, 200);
  const [p] = await db.select().from(prospects).where(eq(prospects.norm, normCompany(name)));
  if (!p) return { error: `No prospect called ${name}.` };
  const status = b.status ? asProspectStatus(s(b.status, 20)) : null;
  if (b.status && !status) return { error: "Unknown status." };
  const now = new Date();
  const set: Partial<typeof prospects.$inferInsert> = { updatedAt: now };
  const email = s(b.contactEmail, 200).toLowerCase();
  if (EMAIL.test(email)) set.contactEmail = email;
  if (s(b.contactName, 120)) set.contactName = s(b.contactName, 120);
  if (s(b.contactRole, 120)) set.contactRole = s(b.contactRole, 120);
  if (s(b.emailSubject, 300)) set.emailSubject = s(b.emailSubject, 300);
  if (s(b.emailBody, 3000).length > 40) set.emailBody = cleanBody(b.emailBody);
  if (s(b.website, 300) && /^https?:\/\/\S+$/.test(s(b.website, 300))) set.website = s(b.website, 300);
  // The assistant can write an email and mark it ready, but never approve or send one.
  if (by === ASSISTANT && (status === "approved" || status === "emailed")) return { error: "Only the desk approves and sends an email." };
  if (status === "drafted" && !(set.emailBody ?? p.emailBody)) return { error: "Give emailSubject and emailBody with a drafted status." };
  const note = s(b.note, 1000);
  if (note) set.notes = [p.notes, `${istDay()} ${by}: ${note}`].filter(Boolean).join("\n").slice(-6000);
  let taskId: number | null = null;
  if (status && status !== p.status) {
    set.status = status;
    if (status === "drafted" && !p.draftedAt) set.draftedAt = now;
    if (status === "emailed" && !p.emailedAt) set.emailedAt = now;
    if ((status === "interested" || status === "declined") && !p.repliedAt) set.repliedAt = now;
    if (status === "interested" && !p.taskId) {
      const who = await caller(s(b.assignee, 80));
      const [t] = await db.insert(tasks).values({
        title: `Call ${p.company}: replied with interest to the desk's email`,
        notes: [p.contactName && `Contact: ${p.contactName}${p.contactRole ? `, ${p.contactRole}` : ""}${p.contactEmail ? ` (${p.contactEmail})` : ""}`,
          `What they need: ${p.kind === "both" ? "equity or debt" : p.kind === "debt" ? "debt" : "pre-IPO equity"}`,
          p.why && `Why it fits: ${p.why}`, note && `Their reply: ${note}`, "See Sourcing in the console for the figures and sources."].filter(Boolean).join("\n"),
        dueOn: nextWorkingDay(), assigneeId: who?.id ?? null, createdBy: by,
      }).returning({ id: tasks.id });
      taskId = t.id;
      set.taskId = t.id;
      if (who) set.assigneeId = who.id;
    }
  }
  await db.update(prospects).set(set).where(eq(prospects.id, p.id));
  return { ok: true, company: p.company, from: p.status, to: status ?? p.status, ...(taskId ? { taskId } : {}) };
}

/** Monday to Saturday, 9 AM to 7 PM IST: the hours in which the desk's outreach goes out. */
export function inSendingHours(now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  return ist.getUTCDay() !== 0 && ist.getUTCHours() >= 9 && ist.getUTCHours() < 19;
}

/** The outreach email as it is sent: plain paragraphs and the desk's sign-off. No tracking, no images. */
export function prospectEmailHtml(body: string) {
  const paras = body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean).map((x) => `<p style="margin:0 0 14px">${esc(x).replace(/\n/g, "<br>")}</p>`).join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.55;color:#1c2333">${paras}
<p style="margin:18px 0 0">Regards,<br>Investment Team, Before the Bell<br>Operated by SintraCap Advisors LLP, Mumbai<br>
<a href="${SITE_URL}">${SITE_URL.replace(/^https?:\/\//, "")}</a> · <a href="mailto:${DESK_EMAIL}">${DESK_EMAIL}</a></p>
<p style="margin:16px 0 0;font-size:12px;color:#6b7590">If this is not relevant, reply to say so and we will not write again.</p></div>`;
}

async function sendOne(p: typeof prospects.$inferSelect) {
  if (!p.contactEmail || !p.emailSubject || !p.emailBody) return false;
  const n = await sendRaw([p.contactEmail], p.emailSubject, prospectEmailHtml(p.emailBody), [], DESK_EMAIL, { kind: "sourcing", step: p.sends ? "follow-up" : "first" });
  if (!n) return false;
  const db = await getDb();
  await db.update(prospects).set({ status: "emailed", emailedAt: new Date(), sends: p.sends + 1, updatedAt: new Date() }).where(eq(prospects.id, p.id));
  return true;
}

/**
 * The desk approves one email. In sending hours it goes at once; otherwise it waits, approved, for the 9 AM run.
 * Returns what happened, for the message shown to the person who clicked.
 */
export async function approveProspect(id: number, by: string, now = new Date()): Promise<{ error: string } | { sent: boolean; company: string }> {
  const db = await getDb();
  const [p] = await db.select().from(prospects).where(eq(prospects.id, id));
  if (!p) return { error: "That prospect is gone." };
  if (p.status !== "drafted") return { error: "Only an email at Draft ready can be approved." };
  if (!p.contactEmail || !p.emailSubject || !p.emailBody) return { error: "The email needs a recipient, a subject and a body first." };
  if (!emailReady()) return { error: "Sending is not set up on this site." };
  await db.update(prospects).set({ status: "approved", approvedBy: by, updatedAt: now }).where(eq(prospects.id, id));
  if (!inSendingHours(now)) return { sent: false, company: p.company };
  const ok = await sendOne({ ...p, status: "approved" });
  return ok ? { sent: true, company: p.company } : { error: "The email was approved but could not be sent just now; it will be tried again at 9 AM." };
}

/**
 * The desk approves every email at Draft ready in one go. In sending hours the first few go at once (kept small so
 * the request finishes); the rest wait, approved, for the 9 AM run, which sends them in daily batches.
 */
export async function approveAllProspects(by: string, now = new Date(), sendNow = 15): Promise<{ error: string } | { approved: number; sent: number; skipped: number }> {
  if (!emailReady()) return { error: "Sending is not set up on this site: add RESEND_API_KEY (and EMAIL_FROM) in Vercel and redeploy." };
  const db = await getDb();
  const drafted = await db.select().from(prospects).where(eq(prospects.status, "drafted"));
  const ready = drafted.filter((p) => p.contactEmail && p.emailSubject && p.emailBody);
  if (!ready.length) return { error: drafted.length ? "None of the drafts has a recipient, a subject and a body yet." : "There are no emails at Draft ready." };
  await db.update(prospects).set({ status: "approved", approvedBy: by, updatedAt: now }).where(inArray(prospects.id, ready.map((p) => p.id)));
  let sent = 0;
  if (inSendingHours(now)) for (const p of ready.slice(0, sendNow)) if (await sendOne({ ...p, status: "approved" })) sent++;
  return { approved: ready.length, sent, skipped: drafted.length - ready.length };
}

/** The 9 AM run: sends every approved email that is still waiting. */
export async function runProspectSends(now = new Date()) {
  if (!emailReady() || !inSendingHours(now)) return { sent: 0, waiting: true };
  const db = await getDb();
  const due = await db.select().from(prospects).where(eq(prospects.status, "approved"));
  let sent = 0;
  for (const p of due.slice(0, 40)) if (await sendOne(p)) sent++;
  return { sent };
}
