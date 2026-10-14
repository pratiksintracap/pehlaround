import "server-only";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { audit, calls, dealViews, interests, ndas, offices, passes, questions } from "@/db/schema";
import type { Deal } from "@/lib/deals";

// The desk's view of one deal: every office that has touched it, at the furthest stage it has reached,
// and the allocation book against the round size.

export const STAGES = [
  { id: "viewed", label: "Viewed", hint: "Opened the overview, no NDA yet" },
  { id: "nda", label: "NDA signed", hint: "In the room, no ask yet" },
  { id: "engaged", label: "Call or Q&A", hint: "Asked a question or a call" },
  { id: "indicated", label: "Indicated", hint: "Asked for an allocation" },
  { id: "term", label: "Term sheet", hint: "Term sheet shared" },
  { id: "docs", label: "Documents", hint: "Signing and KYC" },
  { id: "allotted", label: "Allotted", hint: "Shares allotted" },
  { id: "passed", label: "Passed", hint: "Passed or withdrew" },
] as const;
export type StageId = (typeof STAGES)[number]["id"];

const FROM_STATUS: Record<string, StageId> = { Indicated: "indicated", "Term sheet": "term", Documents: "docs", Allotted: "allotted", Withdrawn: "passed" };

export type Card = {
  officeId: number; office: string; stage: StageId; since: Date; last: Date | null;
  amountCr: number | null; colead: boolean; interestId: number | null; status: string | null; note: string | null;
  shares: number | null; price: number | null; reason: string | null; questions: number; calls: number;
};

/** Round size in ₹ crore: the desk's number, else read from the round label ("₹50 Cr", "₹75 L"). */
export function roundCr(d: Pick<Deal, "roundCr" | "roundLabel">) {
  if (d.roundCr && d.roundCr > 0) return d.roundCr;
  const m = /([\d,.]+)\s*(cr|crore|l|lakh)/i.exec(d.roundLabel || "");
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ""));
  return isFinite(v) ? (/^l/i.test(m[2]) ? v / 100 : v) : null;
}

export async function pipeline(d: Pick<Deal, "id" | "roundCr" | "roundLabel">) {
  const db = await getDb();
  const [os, vs, ns, cs, qs, ins, ps, seen] = await Promise.all([
    db.select({ id: offices.id, name: offices.name }).from(offices),
    db.select({ o: dealViews.officeId, at: sql<Date>`min(${dealViews.at})` }).from(dealViews).where(and(eq(dealViews.dealId, d.id), isNotNull(dealViews.officeId))).groupBy(dealViews.officeId),
    db.select({ o: ndas.officeId, at: ndas.signedAt }).from(ndas).where(and(eq(ndas.dealId, d.id), isNull(ndas.revokedAt))),
    db.select({ o: calls.officeId, at: calls.createdAt }).from(calls).where(and(eq(calls.dealId, d.id), isNotNull(calls.officeId))),
    db.select({ o: questions.officeId, at: questions.askedAt }).from(questions).where(and(eq(questions.dealId, d.id), isNotNull(questions.officeId))),
    db.select().from(interests).where(eq(interests.dealId, d.id)),
    db.select().from(passes).where(eq(passes.dealId, d.id)),
    db.select({ o: audit.officeId, at: sql<Date>`max(${audit.at})` }).from(audit).where(and(eq(audit.dealId, d.id), isNotNull(audit.officeId))).groupBy(audit.officeId),
  ]);
  const name = new Map(os.map((o) => [o.id, o.name]));
  const lastSeen = new Map(seen.map((r) => [r.o as number, new Date(r.at)]));
  const ids = new Set<number>([...vs.map((v) => v.o as number), ...ns.map((n) => n.o), ...ins.map((i) => i.officeId), ...ps.map((p) => p.officeId)]);
  const cards: Card[] = [];
  for (const o of ids) {
    if (!name.has(o)) continue;
    const myIns = ins.filter((i) => i.officeId === o).sort((a, b) => +b.createdAt - +a.createdAt);
    const myPass = ps.filter((p) => p.officeId === o).sort((a, b) => +b.createdAt - +a.createdAt)[0];
    const myQ = qs.filter((q) => q.o === o), myC = cs.filter((c) => c.o === o);
    const nda = ns.find((n) => n.o === o), view = vs.find((v) => v.o === o);
    const live = myIns.find((i) => i.status !== "Withdrawn") ?? myIns[0];
    let stage: StageId, since: Date;
    if (myPass && (!live || +myPass.createdAt > +live.createdAt)) { stage = "passed"; since = myPass.createdAt; }
    else if (live) { stage = FROM_STATUS[live.status] ?? "indicated"; since = live.allottedAt ?? live.createdAt; }
    else if (myQ.length || myC.length) { stage = "engaged"; since = new Date(Math.min(...[...myQ, ...myC].map((x) => +new Date(x.at)))); }
    else if (nda) { stage = "nda"; since = nda.at; }
    else { stage = "viewed"; since = view ? new Date(view.at) : new Date(); }
    cards.push({
      officeId: o, office: name.get(o)!, stage, since, last: lastSeen.get(o) ?? null,
      amountCr: live ? Number(live.amountCr) : null, colead: !!live?.colead, interestId: live?.id ?? null, status: live?.status ?? null, note: live?.note ?? null,
      shares: live?.shares ?? null, price: live?.price ?? null, reason: stage === "passed" ? (myPass?.reason ?? (live?.status === "Withdrawn" ? "Withdrew the request" : null)) : null,
      questions: myQ.length, calls: myC.length,
    });
  }
  cards.sort((a, b) => (+(b.last ?? b.since)) - (+(a.last ?? a.since)));
  const sum = (st: StageId[]) => cards.filter((c) => st.includes(c.stage)).reduce((s, c) => s + (c.amountCr ?? 0), 0);
  const target = roundCr(d);
  const book = {
    target, indicated: sum(["indicated", "term", "docs", "allotted"]), firm: sum(["term", "docs", "allotted"]), allotted: sum(["allotted"]),
    offices: cards.filter((c) => ["indicated", "term", "docs", "allotted"].includes(c.stage)).length,
  };
  return { cards, book, coverage: target ? book.indicated / target : null };
}
