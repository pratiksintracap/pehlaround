import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, deals, deskFiles, deskNotes, documents, leads, offices, prospects, questions, tasks, ticketMessages, tickets } from "@/db/schema";
import { deskDeals } from "@/lib/desk";
import { addMessage, ticketNo } from "@/lib/tickets";
import { dealKind, istDay, stageLabel } from "@/lib/stages";

// What the desk's assistant reads and writes beyond the brief (lib/agent-desk.ts), all through the sealed exchange:
//  - inbox: investor questions, support tickets and inbound leads waiting on the desk, with the deal room's own content
//    to answer from. Its answers are saved as drafts for a person to check and post; nothing reaches an investor from here.
//  - debt: the debt desk's open deals, for shortlisting lenders. Findings go on the deal as a desk note.
//  - scorecard: one week of the desk in numbers.
// It never returns an office's name, documents' files, NDAs, KYC or allocations.

const BY = "Claude (assistant)";
const s = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export async function deskInbox() {
  const db = await getDb();
  const all = await deskDeals();
  const dealOf = new Map(all.map((d) => [d.id, d]));
  const [qs, open, fresh] = await Promise.all([
    db.select().from(questions).where(and(isNull(questions.answer), eq(questions.hidden, false))).orderBy(questions.askedAt),
    db.select().from(tickets).where(eq(tickets.status, "open")).orderBy(tickets.createdAt),
    db.select().from(leads).where(and(eq(leads.status, "New"), gte(leads.createdAt, new Date(Date.now() - 14 * 864e5)))).orderBy(desc(leads.createdAt)),
  ]);
  const dealIds = [...new Set(qs.map((q) => q.dealId))].filter((id) => { const d = dealOf.get(id); return d && !d.listed && !d.debt; });
  const [answered, docs, msgs] = await Promise.all([
    dealIds.length ? db.select({ dealId: questions.dealId, question: questions.question, answer: questions.answer }).from(questions)
      .where(and(inArray(questions.dealId, dealIds), sql`${questions.answer} is not null`, eq(questions.private, false), eq(questions.hidden, false))).orderBy(desc(questions.answeredAt)) : [],
    dealIds.length ? db.select({ dealId: documents.dealId, title: documents.title, kind: documents.kind }).from(documents).where(inArray(documents.dealId, dealIds)) : [],
    open.length ? db.select().from(ticketMessages).where(inArray(ticketMessages.ticketId, open.map((t) => t.id))).orderBy(ticketMessages.createdAt) : [],
  ]);
  return {
    today: istDay(),
    questions: qs.filter((q) => dealIds.includes(q.dealId)).map((q) => ({ id: q.id, company: dealOf.get(q.dealId)!.company, question: q.question, asked: q.askedAt.toISOString().slice(0, 10),
      private: q.private, hasDraft: !!q.draftAnswer, draftBy: q.draftAnswer ? (q.draftBy ?? "Promoter") : null })),
    rooms: dealIds.map((id) => { const d = dealOf.get(id)!; const r = d.room; return { company: d.company, title: d.title, headline: d.headline, category: d.category,
      lede: r.lede, why: r.why, round: r.round, snapshot: r.snapshot, risks: r.risks, terms: r.terms, path: r.path,
      documents: docs.filter((x) => x.dealId === id).map((x) => [x.title, x.kind].filter(Boolean).join(" · ")),
      answeredBefore: answered.filter((x) => x.dealId === id).slice(0, 15).map((x) => ({ q: x.question, a: x.answer })) }; }),
    tickets: open.map((t) => { const m = msgs.filter((x) => x.ticketId === t.id); return { no: ticketNo(t.id), category: t.category, subject: t.subject,
      company: t.dealId ? dealOf.get(t.dealId)?.company ?? null : null, opened: t.createdAt.toISOString().slice(0, 10),
      hasAssistantNote: m.some((x) => x.internal && x.who === BY), messages: m.slice(-6).map((x) => ({ from: x.internal ? "desk note" : x.from, body: x.body.slice(0, 1500) })) }; }),
    leads: fresh.map((l) => ({ id: l.id, kind: l.kind, name: l.name, company: l.company, email: l.email, received: l.createdAt.toISOString().slice(0, 10), details: l.data })),
  };
}

export async function debtBook() {
  const db = await getDb();
  const list = (await deskDeals({ kind: "debt" })).filter((d) => d.pipelineStage !== "closed" && d.pipelineStage !== "archived");
  const notes = list.length ? await db.select({ dealId: deskNotes.dealId, body: deskNotes.body, who: deskNotes.who, at: deskNotes.createdAt }).from(deskNotes)
    .where(inArray(deskNotes.dealId, list.map((d) => d.id))).orderBy(desc(deskNotes.createdAt)) : [];
  return { today: istDay(), deals: list.map((d) => ({ company: d.company, stage: stageLabel(d.pipelineStage), summary: d.headline, ...d.debtInfo,
    notes: notes.filter((x) => x.dealId === d.id).slice(0, 5).map((x) => ({ who: x.who, on: x.at.toISOString().slice(0, 10), body: x.body.slice(0, 1200) })) })) };
}

/** One week of the desk in numbers, for the Friday review. */
export async function scorecard() {
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 864e5), today = istDay();
  const all = await deskDeals();
  const [newOffices, newLeads, asked, waiting, openTickets, added, doneT, overdue, moves, mine, pr] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(offices).where(gte(offices.createdAt, since)),
    db.select({ kind: leads.kind, n: sql<number>`count(*)::int` }).from(leads).where(gte(leads.createdAt, since)).groupBy(leads.kind),
    db.select({ n: sql<number>`count(*)::int` }).from(questions).where(gte(questions.askedAt, since)),
    db.select({ n: sql<number>`count(*)::int` }).from(questions).where(and(isNull(questions.answer), eq(questions.hidden, false))),
    db.select({ n: sql<number>`count(*)::int` }).from(tickets).where(eq(tickets.status, "open")),
    db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(gte(tasks.createdAt, since)),
    db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(and(eq(tasks.status, "done"), gte(tasks.doneAt, since))),
    db.select({ n: sql<number>`count(*)::int` }).from(tasks).where(and(eq(tasks.status, "open"), sql`${tasks.dueOn} < ${today}`)),
    db.select({ action: audit.action, at: audit.at }).from(audit).where(and(gte(audit.at, since), eq(audit.entity, "deal"), sql`${audit.detail}->'changes' ? 'pipelineStage'`)).orderBy(desc(audit.at)),
    db.select({ action: audit.action, at: audit.at }).from(audit).where(and(gte(audit.at, since), eq(audit.who, BY))).orderBy(desc(audit.at)),
    db.select({ status: prospects.status, kind: prospects.kind, createdAt: prospects.createdAt, emailedAt: prospects.emailedAt, repliedAt: prospects.repliedAt }).from(prospects),
  ]);
  const active = all.filter((d) => d.pipelineStage !== "closed" && d.pipelineStage !== "archived");
  const by = <T,>(rows: T[], key: (r: T) => string) => rows.reduce<Record<string, number>>((m, r) => { m[key(r)] = (m[key(r)] ?? 0) + 1; return m; }, {});
  return {
    week: { from: istDay(since), to: today },
    investors: { newOffices: newOffices[0].n, questionsAsked: asked[0].n, questionsWaiting: waiting[0].n, openTickets: openTickets[0].n },
    leads: Object.fromEntries(newLeads.map((l) => [l.kind, l.n])),
    pipeline: { active: active.length, byBook: by(active, (d) => dealKind(d)), byStage: by(active, (d) => stageLabel(d.pipelineStage)), stageMoves: moves.map((m) => m.action) },
    tasks: { added: added[0].n, done: doneT[0].n, overdue: overdue[0].n },
    sourcing: { total: pr.length, byStatus: by(pr, (p) => p.status), foundThisWeek: pr.filter((p) => p.createdAt >= since).length,
      emailedThisWeek: pr.filter((p) => p.emailedAt && p.emailedAt >= since).length, repliesThisWeek: pr.filter((p) => p.repliedAt && p.repliedAt >= since).length },
    assistant: { actions: mine.length, log: mine.slice(0, 40).map((m) => m.action) },
  };
}

/** Deals still being prepared (pre-IPO and debt, at Sourced or Diligence), with what is missing from each. */
export async function prepList() {
  const db = await getDb();
  const list = (await deskDeals()).filter((d) => !d.listed && (d.pipelineStage === "sourced" || d.pipelineStage === "diligence"));
  const ids = list.map((d) => d.id);
  const [notes, files] = await Promise.all([
    ids.length ? db.select({ dealId: deskNotes.dealId, body: deskNotes.body, who: deskNotes.who, at: deskNotes.createdAt }).from(deskNotes).where(inArray(deskNotes.dealId, ids)).orderBy(desc(deskNotes.createdAt)) : [],
    ids.length ? db.select({ dealId: deskFiles.dealId, title: deskFiles.title, url: deskFiles.url }).from(deskFiles).where(inArray(deskFiles.dealId, ids)) : [],
  ]);
  return { today: istDay(), deals: list.map((d) => { const r = d.room; const mine = notes.filter((x) => x.dealId === d.id && x.who === BY && x.body.startsWith("Deal prep"));
    return { company: d.company, book: dealKind(d), stage: stageLabel(d.pipelineStage), inPreparation: d.phase === "preparing", summary: d.headline, sector: d.debt ? d.debtInfo?.sector : d.title,
      ...(d.debt ? { debt: d.debtInfo } : { roomEmpty: { lede: !r.lede, why: !r.why, round: !r.round, snapshot: !r.snapshot.length, risks: !r.risks.length, terms: !r.terms.length } }),
      lastPrep: mine[0]?.at.toISOString().slice(0, 10) ?? null, files: files.filter((x) => x.dealId === d.id).map((x) => ({ title: x.title, url: x.url })) }; }) };
}

const oneDeal = async (name: string) => { const n = name.toLowerCase(); const hits = n ? (await deskDeals()).filter((d) => d.company.toLowerCase().includes(n)) : []; return hits.length === 1 ? hits[0] : null; };

/** The inbox's writes: a draft answer on a question, a desk-only note on a ticket, a desk note on a deal. */
export async function inboxAction(b: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  if (b.action === "draft_answer") {
    const id = Number(b.id) || 0, text = s(b.answer, 4000);
    const [q] = await db.select().from(questions).where(eq(questions.id, id));
    if (!q || text.length < 10) return { error: "Give the question's id and an answer." };
    if (q.answer) return { ok: true, skipped: "already answered" };
    if (q.draftAnswer && !q.draftBy) return { ok: true, skipped: "the promoter has drafted an answer" };
    await db.update(questions).set({ draftAnswer: text, draftAt: new Date(), draftBy: BY }).where(eq(questions.id, id));
    return { ok: true, id, log: { text: "Assistant drafted an answer to an investor question (not posted)", dealId: q.dealId } };
  }
  if (b.action === "ticket_note") {
    const no = s(b.no, 20), text = s(b.body, 4000);
    const id = Number(no.replace(/^BTB-/i, "")) - 1000;
    const [t] = Number.isInteger(id) ? await db.select().from(tickets).where(eq(tickets.id, id)) : [];
    if (!t || text.length < 10) return { error: "Give the ticket number and a note." };
    await addMessage(t.id, "desk", BY, null, text, true);
    return { ok: true, no: ticketNo(t.id), log: { text: `Assistant left a suggested reply on ticket ${ticketNo(t.id)} (desk only)`, dealId: t.dealId } };
  }
  if (b.action === "note") {
    const name = s(b.company, 200).toLowerCase(), text = s(b.body, 6000);
    const hits = name ? (await deskDeals()).filter((d) => d.company.toLowerCase().includes(name)) : [];
    if (hits.length !== 1 || text.length < 10) return { error: hits.length > 1 ? "More than one deal matches that company; use a fuller name." : "Name one deal and give the note." };
    await db.insert(deskNotes).values({ dealId: hits[0].id, body: text, who: BY });
    return { ok: true, company: hits[0].company, log: { text: `Assistant added a desk note on ${hits[0].company}`, dealId: hits[0].id } };
  }
  // A first draft of a deal room, only while the deal is in preparation (desk only) and only into fields that are still empty.
  if (b.action === "room_draft") {
    const d = await oneDeal(s(b.company, 200));
    if (!d) return { error: "Name one deal." };
    if (d.listed || d.debt || d.phase !== "preparing") return { error: "Only a pre-IPO deal still in preparation takes a room draft; use a note instead." };
    const r = { ...d.room }, filled: string[] = [];
    const rows = <T,>(v: unknown, f: (x: Record<string, unknown>) => T | null) => (Array.isArray(v) ? v : []).map((x) => f(x ?? {})).filter(Boolean).slice(0, 12) as T[];
    for (const k of ["lede", "why", "round"] as const) if (!r[k] && s(b[k], 1200)) { r[k] = s(b[k], k === "why" ? 1200 : 300); filled.push(k); }
    const snap = rows(b.snapshot, (x) => (s(x.k, 60) && s(x.v, 80) ? { k: s(x.k, 60), v: s(x.v, 80), ...(s(x.s, 120) ? { s: s(x.s, 120) } : {}) } : null));
    if (!r.snapshot.length && snap.length) { r.snapshot = snap; filled.push("snapshot"); }
    const risks = rows(b.risks, (x) => (s(x.t, 120) && s(x.d, 600) ? { t: s(x.t, 120), d: s(x.d, 600) } : null));
    if (!r.risks.length && risks.length) { r.risks = risks; filled.push("risks"); }
    const terms = rows(b.terms, (x) => (s(x.k, 80) && s(x.v, 300) ? { k: s(x.k, 80), v: s(x.v, 300) } : null));
    if (!r.terms.length && terms.length) { r.terms = terms; filled.push("terms"); }
    if (!filled.length) return { ok: true, skipped: "every field offered already has content" };
    await db.update(deals).set({ room: r, updatedAt: new Date() }).where(eq(deals.id, d.id));
    return { ok: true, company: d.company, filled, log: { text: `Assistant drafted the deal room for ${d.company} (${filled.join(", ")}); in preparation, desk only`, dealId: d.id } };
  }
  // A link the desk keeps on the deal, e.g. the company's Drive folder.
  if (b.action === "file") {
    const d = await oneDeal(s(b.company, 200));
    const url = s(b.url, 500), title = s(b.title, 200);
    if (!d || !title || !/^https:\/\/\S+$/.test(url)) return { error: "Name one deal, a title and an https link." };
    const have = await db.select({ id: deskFiles.id }).from(deskFiles).where(and(eq(deskFiles.dealId, d.id), eq(deskFiles.url, url)));
    if (have.length) return { ok: true, skipped: "already on the deal" };
    await db.insert(deskFiles).values({ dealId: d.id, title, url, kind: s(b.kind, 40) || "Folder", who: BY });
    return { ok: true, company: d.company, log: { text: `Assistant linked ${title} on ${d.company}`, dealId: d.id } };
  }
  return null;
}
