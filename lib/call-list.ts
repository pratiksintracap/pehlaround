import "server-only";
import { and, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { calls, deals, deskNotes, events, interests, ndas, offices, passes, questions } from "@/db/schema";
import { canSeeOffice } from "@/lib/desk";

// Who to call today: offices ranked by what they did on the site lately, with the reasons in plain words.
// Desk only. Reads the investor-side funnel (events), allocation requests, call requests, NDAs and questions, and
// pushes down anyone the desk spoke to or noted in the last two days.

export type Reason = { w: number; text: string; dealId?: number };
export type CallRow = { officeId: number; name: string; score: number; reasons: Reason[]; contacted: Date | null };

const DAY = 864e5;
const days = (d: Date, now: Date) => Math.max(0, Math.floor((+now - +d) / DAY));
const ago = (d: Date, now: Date) => { const n = days(d, now); return n === 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`; };

export async function callList(me: { id: number; role: string }, opts: { now?: Date; limit?: number } = {}): Promise<CallRow[]> {
  const now = opts.now ?? new Date();
  const since = (n: number) => new Date(+now - n * DAY);
  const db = await getDb();
  const [ev, asks, callReqs, signed, qs, fresh, passed, notes, ds] = await Promise.all([
    db.select({ kind: events.kind, officeId: events.officeId, dealId: events.dealId, at: events.at }).from(events)
      .where(and(gte(events.at, since(14)), inArray(events.kind, ["deck_opened", "databank_opened", "room_opened"]))),
    db.select().from(interests).where(and(eq(interests.status, "Indicated"), gte(interests.createdAt, since(45)))),
    db.select({ officeId: calls.officeId, dealId: calls.dealId, at: calls.createdAt }).from(calls).where(and(eq(calls.kind, "request"), eq(calls.status, "Requested"))),
    db.select({ officeId: ndas.officeId, dealId: ndas.dealId, at: ndas.signedAt }).from(ndas).where(and(gte(ndas.signedAt, since(21)), isNull(ndas.revokedAt))),
    db.select({ officeId: questions.officeId, dealId: questions.dealId, at: questions.askedAt }).from(questions).where(gte(questions.askedAt, since(7))),
    db.select({ id: offices.id, approvedAt: offices.approvedAt }).from(offices).where(and(eq(offices.approval, "approved"), gte(offices.approvedAt, since(10)))),
    db.select({ officeId: passes.officeId, dealId: passes.dealId, reason: passes.reason, at: passes.createdAt }).from(passes).where(gte(passes.createdAt, since(7))),
    db.select({ officeId: deskNotes.officeId, at: deskNotes.createdAt }).from(deskNotes).where(gte(deskNotes.createdAt, since(2))),
    db.select({ id: deals.id, company: deals.company, listed: deals.listed }).from(deals),
  ]);
  const co = new Map(ds.filter((d) => !d.listed).map((d) => [d.id, d.company]));
  const by = new Map<number, Reason[]>();
  const add = (officeId: number | null, r: Reason) => { if (!officeId || (r.dealId && !co.has(r.dealId))) return; (by.get(officeId) ?? by.set(officeId, []).get(officeId)!).push(r); };
  const name = (id?: number | null) => (id ? co.get(id) ?? "a deal" : "a deal");

  for (const a of asks) {
    const n = days(a.createdAt, now);
    add(a.officeId, n <= 3 ? { w: 14, dealId: a.dealId, text: `Asked for ₹${Number(a.amountCr)} Cr in ${name(a.dealId)} ${ago(a.createdAt, now)}` }
      : { w: n <= 14 ? 10 : 6, dealId: a.dealId, text: `Asked for ₹${Number(a.amountCr)} Cr in ${name(a.dealId)} ${ago(a.createdAt, now)}, still at Indicated` });
  }
  for (const c of callReqs) add(c.officeId, { w: 12, dealId: c.dealId, text: `Asked for a call on ${name(c.dealId)} ${ago(c.at, now)}` });

  const count = new Map<string, { n: number; last: Date; kind: string; officeId: number; dealId: number }>();
  for (const e of ev) {
    if (!e.officeId || !e.dealId) continue;
    const k = `${e.kind}|${e.officeId}|${e.dealId}`;
    const c = count.get(k) ?? { n: 0, last: e.at, kind: e.kind, officeId: e.officeId, dealId: e.dealId };
    c.n++; if (e.at > c.last) c.last = e.at; count.set(k, c);
  }
  for (const c of count.values()) {
    const recent = days(c.last, now) <= 7;
    if (c.kind === "deck_opened" && recent) add(c.officeId, { w: c.n >= 2 ? 5 + Math.min(c.n, 5) : days(c.last, now) <= 3 ? 3 : 1, dealId: c.dealId, text: c.n >= 2 ? `Opened the ${name(c.dealId)} deck ${c.n} times, last ${ago(c.last, now)}` : `Read the ${name(c.dealId)} deck ${ago(c.last, now)}` });
    if (c.kind === "databank_opened" && recent) add(c.officeId, { w: 5, dealId: c.dealId, text: `Went into the ${name(c.dealId)} data bank ${ago(c.last, now)}` });
    if (c.kind === "room_opened" && recent && c.n >= 2) add(c.officeId, { w: 3 + Math.min(c.n, 4), dealId: c.dealId, text: `Back in the ${name(c.dealId)} room ${c.n} times in two weeks` });
  }
  const opened = new Set(ev.filter((e) => e.kind === "room_opened").map((e) => `${e.officeId}|${e.dealId}`));
  for (const s of signed) if (days(s.at, now) >= 2 && !opened.has(`${s.officeId}|${s.dealId}`)) add(s.officeId, { w: 5, dealId: s.dealId, text: `Signed the ${name(s.dealId)} NDA ${ago(s.at, now)} but has not opened the room` });
  for (const q of qs) add(q.officeId, { w: 4, dealId: q.dealId, text: `Asked a question on ${name(q.dealId)} ${ago(q.at, now)}` });
  for (const p of passed) add(p.officeId, { w: 2, dealId: p.dealId, text: `Passed on ${name(p.dealId)} ${ago(p.at, now)}: “${p.reason}”` });
  const anyNda = new Set((fresh.length ? await db.select({ officeId: ndas.officeId }).from(ndas).where(inArray(ndas.officeId, fresh.map((f) => f.id))) : []).map((r) => r.officeId));
  for (const f of fresh) if (f.approvedAt && !anyNda.has(f.id) && days(f.approvedAt, now) >= 1) add(f.id, { w: 4, text: `Approved ${ago(f.approvedAt, now)}, no NDA signed yet` });

  if (!by.size) return [];
  const os = await db.select({ id: offices.id, name: offices.name, origin: offices.origin, addedById: offices.addedById, approval: offices.approval })
    .from(offices).where(and(inArray(offices.id, [...by.keys()]), ne(offices.approval, "rejected")));
  const lastNote = new Map<number, Date>();
  for (const n of notes) if (n.officeId && (!lastNote.has(n.officeId) || n.at > lastNote.get(n.officeId)!)) lastNote.set(n.officeId, n.at);
  const rows: CallRow[] = os.filter((o) => canSeeOffice(me, o)).map((o) => {
    // one reason per deal and kind is enough; the strongest first
    const reasons = by.get(o.id)!.sort((a, b) => b.w - a.w);
    const raw = reasons.reduce((s, r, i) => s + r.w * (i < 3 ? 1 : 0.4), 0);
    const contacted = lastNote.get(o.id) ?? null;
    return { officeId: o.id, name: o.name, score: Math.round((contacted ? raw * 0.3 : raw) * 10) / 10, reasons, contacted };
  });
  return rows.filter((r) => r.score >= 3).sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 30);
}
