import "server-only";
// Desk-only reads for the workflow: every deal (listed companies included), notes, files, tasks and the trail.
// Nothing here is used by an investor-facing page; investor pages read deals through lib/deals.ts.
import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, deals, deskFiles, deskNotes, offices, tasks, users } from "@/db/schema";
import { istDay } from "@/lib/stages";

export type DeskDeal = typeof deals.$inferSelect;
export type Task = typeof tasks.$inferSelect;

/** Every deal on the desk, pre-IPO and listed, in desk order. */
export async function deskDeals(opts: { listed?: boolean } = {}) {
  const db = await getDb();
  const where = opts.listed === undefined ? undefined : eq(deals.listed, opts.listed);
  return db.select().from(deals).where(where).orderBy(asc(deals.sort), asc(deals.id));
}

export async function deskDeal(id: number) {
  const db = await getDb();
  return (await db.select().from(deals).where(eq(deals.id, id)))[0] ?? null;
}

/** People who can own deals and take tasks: active super admins and analysts. */
export async function deskMembers() {
  const db = await getDb();
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users)
    .where(and(inArray(users.role, ["admin", "analyst"]), eq(users.disabled, false))).orderBy(asc(users.name));
}

/** Open tasks first (overdue, then by due date), then the most recently finished. */
export function sortTasks(list: Task[]) {
  const today = istDay();
  const rank = (t: Task) => (t.status === "done" ? 3 : t.dueOn && t.dueOn < today ? 0 : t.dueOn ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.status === "done" ? +(b.doneAt ?? 0) - +(a.doneAt ?? 0) : (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999")) || a.id - b.id);
}

export async function listTasks(f: { dealId?: number; officeId?: number; assigneeId?: number; status?: "open" | "done" | "all"; overdue?: boolean } = {}) {
  const db = await getDb();
  const c = [
    f.dealId ? eq(tasks.dealId, f.dealId) : undefined,
    f.officeId ? eq(tasks.officeId, f.officeId) : undefined,
    f.assigneeId ? eq(tasks.assigneeId, f.assigneeId) : undefined,
    !f.status || f.status === "open" ? eq(tasks.status, "open") : f.status === "done" ? eq(tasks.status, "done") : undefined,
    f.overdue ? lte(tasks.dueOn, istDay()) : undefined,
  ].filter(Boolean);
  return sortTasks(await db.select().from(tasks).where(c.length ? and(...c) : undefined).orderBy(desc(tasks.createdAt)).limit(500));
}

/** Everything the desk workspace on a deal page shows. */
export async function workspace(dealId: number) {
  const db = await getDb();
  const [notes, files, ts, trail] = await Promise.all([
    db.select().from(deskNotes).where(eq(deskNotes.dealId, dealId)).orderBy(desc(deskNotes.createdAt)).limit(200),
    db.select().from(deskFiles).where(eq(deskFiles.dealId, dealId)).orderBy(desc(deskFiles.createdAt)),
    db.select().from(tasks).where(eq(tasks.dealId, dealId)).orderBy(desc(tasks.createdAt)).limit(200),
    db.select().from(audit).where(and(eq(audit.dealId, dealId), sql`${audit.officeId} is null`)).orderBy(desc(audit.at)).limit(60),
  ]);
  return { notes, files, tasks: sortTasks(ts), trail };
}

/** Names for ids in lists (deals, offices, desk members). */
export async function names() {
  const db = await getDb();
  const [ds, os, us] = await Promise.all([
    db.select({ id: deals.id, company: deals.company, listed: deals.listed }).from(deals),
    db.select({ id: offices.id, name: offices.name }).from(offices),
    db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.role, ["admin", "analyst"])),
  ]);
  return { deal: new Map(ds.map((d) => [d.id, d])), office: new Map(os.map((o) => [o.id, o.name])), user: new Map(us.map((u) => [u.id, u.name])) };
}

/** A desk member's own view: deals they run that are not closed, offices waiting for approval, their open tasks. */
export async function myDesk(me: { id: number }) {
  const db = await getDb();
  const [mine, pending, myTasks, overdueAll] = await Promise.all([
    db.select().from(deals).where(and(eq(deals.ownerId, me.id), ne(deals.pipelineStage, "closed"))).orderBy(asc(deals.sort)),
    db.select({ id: offices.id, name: offices.name, investorType: offices.investorType, createdAt: offices.createdAt }).from(offices)
      .where(eq(offices.approval, "pending")).orderBy(asc(offices.createdAt)).limit(8),
    listTasks({ assigneeId: me.id }),
    db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(and(eq(tasks.status, "open"), sql`${tasks.dueOn} < ${istDay()}`)),
  ]);
  const unowned = (await db.select({ id: deals.id, company: deals.company, listed: deals.listed, pipelineStage: deals.pipelineStage }).from(deals)
    .where(and(sql`${deals.ownerId} is null`, ne(deals.pipelineStage, "closed"))).orderBy(asc(deals.sort)));
  return { mine, pending, myTasks, overdueAll: overdueAll[0]?.n ?? 0, unowned };
}

/** Open tasks assigned to someone (the admin menu badge). */
export async function openTaskCount(userId: number) {
  const db = await getDb();
  return (await db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(and(eq(tasks.assigneeId, userId), eq(tasks.status, "open"))))[0]?.n ?? 0;
}
