import "server-only";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealViews, events, interests, ndas, offices } from "@/db/schema";

/* How far each office has gone with a company: the three-layer journey, read back for the desk.
   viewed  → opened the overview (layer 2, signed in)
   deck    → opened the pitch deck or IM before the NDA
   nda     → signed this company's NDA
   databank→ opened the data bank from the room (layer 3)
   asked   → requested an allocation */
export type Stage = "viewed" | "deck" | "nda" | "databank" | "asked";
export const STAGE_LABEL: Record<Stage, string> = { viewed: "Looked", deck: "Opened the deck", nda: "Signed the NDA", databank: "Opened the data bank", asked: "Asked for an allocation" };
const RANK: Record<Stage, number> = { viewed: 1, deck: 2, nda: 3, databank: 4, asked: 5 };

export async function dealInterest(dealId: number) {
  const db = await getDb();
  const [views, decks, banks, signed, asked] = await Promise.all([
    db.select({ o: dealViews.officeId, n: sql<number>`count(*)::int`, last: sql<Date>`max(${dealViews.at})` }).from(dealViews).where(eq(dealViews.dealId, dealId)).groupBy(dealViews.officeId),
    db.select({ o: events.officeId, n: sql<number>`count(*)::int`, last: sql<Date>`max(${events.at})` }).from(events).where(and(eq(events.dealId, dealId), eq(events.kind, "deck_opened"))).groupBy(events.officeId),
    db.select({ o: events.officeId, n: sql<number>`count(*)::int`, last: sql<Date>`max(${events.at})` }).from(events).where(and(eq(events.dealId, dealId), eq(events.kind, "databank_opened"))).groupBy(events.officeId),
    db.select({ o: ndas.officeId, last: ndas.signedAt }).from(ndas).where(and(eq(ndas.dealId, dealId), isNull(ndas.revokedAt))),
    db.select({ o: interests.officeId }).from(interests).where(and(eq(interests.dealId, dealId), ne(interests.status, "Withdrawn"))),
  ]);
  const byOffice = new Map<number, { stage: Stage; views: number; decks: number; banks: number; last: Date | null }>();
  const bump = (o: number | null, stage: Stage, n = 0, last: Date | null = null) => {
    if (!o) return;
    const cur = byOffice.get(o) ?? { stage, views: 0, decks: 0, banks: 0, last: null };
    if (RANK[stage] > RANK[cur.stage]) cur.stage = stage;
    if (stage === "viewed") cur.views += n; if (stage === "deck") cur.decks += n; if (stage === "databank") cur.banks += n;
    if (last && (!cur.last || last > cur.last)) cur.last = last;
    byOffice.set(o, cur);
  };
  for (const v of views) bump(v.o, "viewed", v.n, v.last ? new Date(v.last) : null);
  for (const v of decks) bump(v.o, "deck", v.n, v.last ? new Date(v.last) : null);
  for (const v of signed) bump(v.o, "nda", 0, v.last);
  for (const v of banks) bump(v.o, "databank", v.n, v.last ? new Date(v.last) : null);
  for (const v of asked) bump(v.o, "asked");
  const ids = [...byOffice.keys()];
  const names = ids.length ? await db.select({ id: offices.id, name: offices.name }).from(offices).where(inArray(offices.id, ids)) : [];
  const nm = new Map(names.map((x) => [x.id, x.name]));
  const rows = ids.map((id) => ({ officeId: id, name: nm.get(id) ?? `Office #${id}`, ...byOffice.get(id)! })).sort((a, b) => RANK[b.stage] - RANK[a.stage] || (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));
  // Funnel counts: an office at a later stage counts in every earlier one too.
  const counts: Record<Stage, number> = { viewed: 0, deck: 0, nda: 0, databank: 0, asked: 0 };
  for (const r of rows) for (const s of Object.keys(RANK) as Stage[]) if (RANK[s] <= RANK[r.stage]) counts[s]++;
  const anon = views.find((v) => !v.o)?.n ?? 0; // overview opens by visitors not signed in
  return { rows, counts, anon };
}

/** Per office, across deals: how many decks and data banks it opened (for the offices list). */
export async function officeEngagement() {
  const db = await getDb();
  const rows = await db.select({ o: events.officeId, kind: events.kind, n: sql<number>`count(distinct ${events.dealId})::int` }).from(events)
    .where(inArray(events.kind, ["deck_opened", "databank_opened"])).groupBy(events.officeId, events.kind);
  const m = new Map<number, { decks: number; banks: number }>();
  for (const r of rows) { if (!r.o) continue; const c = m.get(r.o) ?? { decks: 0, banks: 0 }; if (r.kind === "deck_opened") c.decks = r.n; else c.banks = r.n; m.set(r.o, c); }
  return m;
}
