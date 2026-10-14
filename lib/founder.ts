import "server-only";
import { and, desc, eq, gt, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { audit, calls, deals, dealViews, docViews, documents, interests, ndas, passes, questions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import type { Deal } from "@/lib/deals";
import { isDesk } from "@/lib/perm";
import { roundCr } from "@/lib/pipeline";

// The founder portal: a promoter sees how their round is going, never which offices.

/** The signed-in promoter and their deal. The desk can preview any deal with ?deal=slug. */
export async function founderContext(preview?: string) {
  const user = await requireUser("/founder");
  const db = await getDb();
  const all: Deal[] = await db.select().from(deals).orderBy(deals.sort, deals.id); // live, not the public cache
  if (isDesk(user)) {
    const d = all.find((x) => x.slug === preview) ?? all[0];
    if (!d) redirect("/admin/deals");
    return { user, deal: d, preview: true };
  }
  if (user.role !== "promoter" || !user.promoterDealId) redirect("/dashboard");
  const d = all.find((x) => x.id === user.promoterDealId);
  if (!d) redirect("/");
  return { user, deal: d, preview: false };
}

const ago = (days: number) => new Date(Date.now() - days * 864e5);

export async function founderStats(d: Deal) {
  const db = await getDb();
  const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const c = sql<number>`count(*)::int`;
  const [views30, offViewed, ndaAll, nda30, active7, docOpens, docOffices, qAll, qAnswered, callN, ins, ps, weeks] = await Promise.all([
    n(db.select({ n: c }).from(dealViews).where(and(eq(dealViews.dealId, d.id), gt(dealViews.at, ago(30))))),
    n(db.select({ n: sql<number>`count(distinct ${dealViews.officeId})::int` }).from(dealViews).where(and(eq(dealViews.dealId, d.id), isNotNull(dealViews.officeId)))),
    n(db.select({ n: c }).from(ndas).where(and(eq(ndas.dealId, d.id), isNull(ndas.revokedAt)))),
    n(db.select({ n: c }).from(ndas).where(and(eq(ndas.dealId, d.id), isNull(ndas.revokedAt), gt(ndas.signedAt, ago(30))))),
    n(db.select({ n: sql<number>`count(distinct ${audit.officeId})::int` }).from(audit).where(and(eq(audit.dealId, d.id), isNotNull(audit.officeId), gt(audit.at, ago(7))))),
    n(db.select({ n: c }).from(docViews).innerJoin(documents, eq(documents.id, docViews.documentId)).where(eq(documents.dealId, d.id))),
    n(db.select({ n: sql<number>`count(distinct ${docViews.officeId})::int` }).from(docViews).innerJoin(documents, eq(documents.id, docViews.documentId)).where(eq(documents.dealId, d.id))),
    n(db.select({ n: c }).from(questions).where(and(eq(questions.dealId, d.id), isNotNull(questions.officeId)))),
    n(db.select({ n: c }).from(questions).where(and(eq(questions.dealId, d.id), isNotNull(questions.officeId), isNotNull(questions.answer)))),
    n(db.select({ n: c }).from(calls).where(and(eq(calls.dealId, d.id), eq(calls.kind, "request")))),
    db.select({ o: interests.officeId, amt: interests.amountCr, st: interests.status }).from(interests).where(and(eq(interests.dealId, d.id), ne(interests.status, "Withdrawn"))),
    db.select({ reason: passes.reason }).from(passes).where(eq(passes.dealId, d.id)),
    db.select({ at: ndas.signedAt }).from(ndas).where(and(eq(ndas.dealId, d.id), isNull(ndas.revokedAt), gt(ndas.signedAt, ago(56)))),
  ]);
  const weekly = Array.from({ length: 8 }, (_, k) => weeks.filter((w) => { const age = (Date.now() - +new Date(w.at)) / (7 * 864e5); return age >= 7 - k && age < 8 - k; }).length);
  const reasons = Object.entries(ps.reduce<Record<string, number>>((m, p) => ((m[p.reason] = (m[p.reason] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const indicatedOffices = new Set(ins.map((i) => i.o)).size;
  const total = ins.reduce((t, i) => t + Number(i.amt), 0);
  return {
    views30, offViewed, ndaAll, nda30, active7, docOpens, docOffices, qAll, qAnswered, callN, weekly, reasons,
    indicatedOffices, demand: d.promoterDemand ? { total, target: roundCr(d) } : null,
  };
}

export async function founderQuestions(dealId: number) {
  const db = await getDb();
  return db.select({ id: questions.id, question: questions.question, answer: questions.answer, answeredAt: questions.answeredAt, askedAt: questions.askedAt,
    private: questions.private, draftAnswer: questions.draftAnswer, draftAt: questions.draftAt, fromOffice: sql<boolean>`${questions.officeId} is not null` })
    .from(questions).where(and(eq(questions.dealId, dealId), eq(questions.hidden, false))).orderBy(desc(questions.askedAt));
}

export async function founderDocuments(dealId: number) {
  const db = await getDb();
  const docs = await db.select().from(documents).where(eq(documents.dealId, dealId)).orderBy(documents.sort, documents.id);
  const opens = await db.select({ id: docViews.documentId, n: sql<number>`count(distinct ${docViews.officeId})::int` }).from(docViews)
    .innerJoin(documents, eq(documents.id, docViews.documentId)).where(eq(documents.dealId, dealId)).groupBy(docViews.documentId);
  const m = new Map(opens.map((o) => [o.id, Number(o.n)]));
  return docs.map((x) => ({ id: x.id, title: x.title, kind: x.kind, status: x.status, offices: m.get(x.id) ?? 0, proposedBy: x.proposedBy, audience: x.audience }));
}
