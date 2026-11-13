import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { prospects, tasks, users } from "@/db/schema";
import { istDay } from "@/lib/stages";

// Deal sourcing. The scheduled assistant finds companies that may suit the desk (pre-IPO equity, a debt need, or both),
// logs them here, and writes an outreach email for each as a draft in the desk mailbox. A person sends it. Only when a
// company replies with interest does the banker get a call task. Nothing here is ever shown outside the console.

export const PROSPECT_STATUS = [
  { id: "new", label: "Found", hint: "Logged; no outreach draft yet" },
  { id: "drafted", label: "Draft ready", hint: "Outreach draft waiting in the desk mailbox" },
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
    emailSubject: prospects.emailSubject, draftedAt: prospects.draftedAt, emailedAt: prospects.emailedAt }).from(prospects);
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
