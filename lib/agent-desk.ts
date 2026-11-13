import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, deals, leads, offices, questions, tasks, users } from "@/db/schema";
import { asStage, istDay, stageLabel } from "@/lib/stages";
import { log } from "@/lib/auth";
import { deskDeals, deskMembers } from "@/lib/desk";

// The desk's scheduled assistant (morning brief, meeting follow-ups, weekly pipeline review) reads the desk through this
// endpoint and can make two small changes: add a task, or move a deal to another pipeline stage. Every change is logged
// under "Claude (assistant)". Requests arrive sealed through the repository's agent workflow (lib/agent-exchange.ts).
// It never returns investor documents, NDAs, allocations or anything about an office beyond its name.

const WHO = { id: 0, name: "Claude (assistant)", officeId: null };

/** What the assistant reads: tasks due, the pipeline with quiet and unowned deals, the last day's leads. */
export async function deskBrief() {
  const db = await getDb();
  const today = istDay();
  const quietSince = new Date(Date.now() - 14 * 864e5);
  const since24 = new Date(Date.now() - 864e5);
  const desk = await deskMembers();
  const nameOf = (id: number | null) => desk.find((u) => u.id === id)?.name ?? null;

  const [open, dl, lastTouch, fresh, unanswered] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, notes: tasks.notes, dueOn: tasks.dueOn, assigneeId: tasks.assigneeId, dealId: tasks.dealId }).from(tasks)
      .where(and(eq(tasks.status, "open"), lte(tasks.dueOn, today))).orderBy(tasks.dueOn),
    deskDeals().then((all) => all.filter((d) => d.pipelineStage !== "archived").map((d) => ({ id: d.id, company: d.company, stage: d.pipelineStage, stageAt: d.stageAt, ownerId: d.ownerId, listed: d.listed, ipoOnly: d.ipoOnly, updatedAt: d.updatedAt }))),
    db.select({ dealId: audit.dealId, last: sql<Date>`max(${audit.at})` }).from(audit).groupBy(audit.dealId),
    db.select({ kind: leads.kind, name: leads.name, company: leads.company, at: leads.createdAt }).from(leads).where(gte(leads.createdAt, since24)).orderBy(desc(leads.createdAt)),
    db.select({ id: questions.id, dealId: questions.dealId }).from(questions).where(isNull(questions.answer)),
  ]);
  const last = new Map(lastTouch.map((r) => [r.dealId, new Date(r.last)]));
  const company = (id: number | null) => dl.find((d) => d.id === id)?.company ?? null;
  const pipeline = dl.map((d) => {
    const touched = [last.get(d.id), d.updatedAt, d.stageAt].filter(Boolean).sort((a, b) => +b! - +a!)[0] as Date;
    return { id: d.id, company: d.company, stage: d.stage, stageLabel: stageLabel(d.stage), owner: nameOf(d.ownerId), kind: d.listed ? "listed" : d.ipoOnly ? "ipo" : "pre-ipo",
      lastActivity: touched.toISOString().slice(0, 10), quiet: d.stage !== "closed" && touched < quietSince };
  });
  const newOffices = await db.select({ name: offices.name, at: offices.createdAt }).from(offices).where(gte(offices.createdAt, since24));

  return {
    today,
    tasksDue: open.map((t) => ({ ...t, assignee: nameOf(t.assigneeId), company: company(t.dealId), overdue: (t.dueOn ?? today) < today })),
    pipeline,
    unownedDeals: pipeline.filter((p) => !p.owner && p.stage !== "closed").map((p) => p.company),
    quietDeals: pipeline.filter((p) => p.quiet).map((p) => ({ company: p.company, stage: p.stageLabel, lastActivity: p.lastActivity })),
    last24h: { leads: fresh, newOffices: newOffices.map((o) => o.name) },
    unansweredQuestions: unanswered.length,
    deskMembers: desk.map((u) => u.name),
    stages: ["sourced", "diligence", "live", "interest", "docs", "escrow", "closed", "archived"],
  };
}

// { action: "task", title, notes?, dueOn?: "YYYY-MM-DD", company?, assignee? } or { action: "stage", company, stage, note }
export async function deskAction(b: Record<string, string>): Promise<Record<string, unknown>> {
  const db = await getDb();
  const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const findDeal = async (name: string) => {
    if (!name) return null;
    const n = name.toLowerCase();
    const rows = (await deskDeals()).filter((d) => d.company.toLowerCase().includes(n)).map((d) => ({ id: d.id, company: d.company, stage: d.pipelineStage }));
    return rows.length === 1 ? rows[0] : rows.length > 1 ? "ambiguous" : null;
  };
  if (b.action === "task") {
    const title = s(b.title, 200);
    if (!title) return ({ error: "A title is needed." });
    const d = await findDeal(s(b.company, 120));
    if (d === "ambiguous") return ({ error: "More than one deal matches that company; use a fuller name." });
    const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(s(b.dueOn, 10)) ? s(b.dueOn, 10) : istDay();
    const [a] = b.assignee ? await db.select({ id: users.id }).from(users).where(and(inArray(users.role, ["admin", "analyst"]), sql`lower(${users.name}) like ${"%" + s(b.assignee, 80).toLowerCase() + "%"}`)) : [];
    const [t] = await db.insert(tasks).values({ title, notes: s(b.notes, 2000) || null, dueOn, dealId: d?.id ?? null, assigneeId: a?.id ?? null, createdBy: WHO.name }).returning({ id: tasks.id });
    await log(WHO, `Assistant added a task: ${title}`, d?.id ?? null, { entity: "task", entityId: t.id });
    return ({ ok: true, taskId: t.id, company: d?.company ?? null });
  }
  if (b.action === "stage") {
    const d = await findDeal(s(b.company, 120));
    const stage = asStage(s(b.stage, 20));
    if (!d || d === "ambiguous" || !stage) return ({ error: "Name one deal and a valid stage." });
    if (stage === d.stage) return ({ ok: true, unchanged: true });
    await db.update(deals).set({ pipelineStage: stage, stageAt: new Date(), updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant moved ${d.company} from ${stageLabel(d.stage)} to ${stageLabel(stage)}${b.note ? `: ${s(b.note, 300)}` : ""}`, d.id,
      { entity: "deal", entityId: d.id, detail: { changes: { pipelineStage: [d.stage, stage] } } });
    return ({ ok: true, company: d.company, from: d.stage, to: stage });
  }
  return ({ error: "Unknown action." });
}
