import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, deals, leads, offices, questions, tasks, users } from "@/db/schema";
import { asStage, istDay, stageLabel } from "@/lib/stages";
import { log } from "@/lib/auth";

// The desk's scheduled assistant (morning brief, meeting follow-ups, weekly pipeline review) reads the desk through this
// endpoint and can make two small changes: add a task, or move a deal to another pipeline stage. Every change is logged
// under "Claude (assistant)". It needs the AGENT_TOKEN set in the hosting environment; without it the endpoint is off.
// It never returns investor documents, NDAs, allocations or anything about an office beyond its name.

const WHO = { id: 0, name: "Claude (assistant)", officeId: null };

function authorised(req: Request) {
  const want = process.env.AGENT_TOKEN;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!want || want.length < 32 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
const deny = () => NextResponse.json({ error: "Not allowed." }, { status: 401 });

export async function GET(req: Request) {
  if (!authorised(req)) return deny();
  const db = await getDb();
  const today = istDay();
  const quietSince = new Date(Date.now() - 14 * 864e5);
  const since24 = new Date(Date.now() - 864e5);
  const desk = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.role, ["admin", "analyst"]));
  const nameOf = (id: number | null) => desk.find((u) => u.id === id)?.name ?? null;

  const [open, dl, lastTouch, fresh, unanswered] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, notes: tasks.notes, dueOn: tasks.dueOn, assigneeId: tasks.assigneeId, dealId: tasks.dealId }).from(tasks)
      .where(and(eq(tasks.status, "open"), lte(tasks.dueOn, today))).orderBy(tasks.dueOn),
    db.select({ id: deals.id, company: deals.company, stage: deals.pipelineStage, stageAt: deals.stageAt, ownerId: deals.ownerId, listed: deals.listed, ipoOnly: deals.ipoOnly, updatedAt: deals.updatedAt })
      .from(deals).where(ne(deals.pipelineStage, "archived")),
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

  return NextResponse.json({
    today,
    tasksDue: open.map((t) => ({ ...t, assignee: nameOf(t.assigneeId), company: company(t.dealId), overdue: (t.dueOn ?? today) < today })),
    pipeline,
    unownedDeals: pipeline.filter((p) => !p.owner && p.stage !== "closed").map((p) => p.company),
    quietDeals: pipeline.filter((p) => p.quiet).map((p) => ({ company: p.company, stage: p.stageLabel, lastActivity: p.lastActivity })),
    last24h: { leads: fresh, newOffices: newOffices.map((o) => o.name) },
    unansweredQuestions: unanswered.length,
    deskMembers: desk.map((u) => u.name),
    stages: ["sourced", "diligence", "live", "interest", "docs", "escrow", "closed", "archived"],
  }, { headers: { "Cache-Control": "no-store" } });
}

// { action: "task", title, notes?, dueOn?: "YYYY-MM-DD", company?, assignee? } or { action: "stage", company, stage, note }
export async function POST(req: Request) {
  if (!authorised(req)) return deny();
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const db = await getDb();
  const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
  const findDeal = async (name: string) => {
    if (!name) return null;
    const rows = await db.select({ id: deals.id, company: deals.company, stage: deals.pipelineStage }).from(deals).where(sql`lower(${deals.company}) like ${"%" + name.toLowerCase() + "%"}`);
    return rows.length === 1 ? rows[0] : rows.length > 1 ? "ambiguous" : null;
  };
  if (b.action === "task") {
    const title = s(b.title, 200);
    if (!title) return NextResponse.json({ error: "A title is needed." }, { status: 400 });
    const d = await findDeal(s(b.company, 120));
    if (d === "ambiguous") return NextResponse.json({ error: "More than one deal matches that company; use a fuller name." }, { status: 400 });
    const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(s(b.dueOn, 10)) ? s(b.dueOn, 10) : istDay();
    const [a] = b.assignee ? await db.select({ id: users.id }).from(users).where(and(inArray(users.role, ["admin", "analyst"]), sql`lower(${users.name}) like ${"%" + s(b.assignee, 80).toLowerCase() + "%"}`)) : [];
    const [t] = await db.insert(tasks).values({ title, notes: s(b.notes, 2000) || null, dueOn, dealId: d?.id ?? null, assigneeId: a?.id ?? null, createdBy: WHO.name }).returning({ id: tasks.id });
    await log(WHO, `Assistant added a task: ${title}`, d?.id ?? null, { entity: "task", entityId: t.id });
    return NextResponse.json({ ok: true, taskId: t.id, company: d?.company ?? null });
  }
  if (b.action === "stage") {
    const d = await findDeal(s(b.company, 120));
    const stage = asStage(s(b.stage, 20));
    if (!d || d === "ambiguous" || !stage) return NextResponse.json({ error: "Name one deal and a valid stage." }, { status: 400 });
    if (stage === d.stage) return NextResponse.json({ ok: true, unchanged: true });
    await db.update(deals).set({ pipelineStage: stage, stageAt: new Date(), updatedAt: new Date() }).where(eq(deals.id, d.id));
    await log(WHO, `Assistant moved ${d.company} from ${stageLabel(d.stage)} to ${stageLabel(stage)}${b.note ? `: ${s(b.note, 300)}` : ""}`, d.id,
      { entity: "deal", entityId: d.id, detail: { changes: { pipelineStage: [d.stage, stage] } } });
    return NextResponse.json({ ok: true, company: d.company, from: d.stage, to: stage });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
