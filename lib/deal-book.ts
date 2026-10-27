// The deal book: every deal on the desk (published, coming, in preparation, and After the Bell) with its key facts,
// activity and what is missing. Super admin only (app/admin/book); printed to PDF from the browser.
import "server-only";
import { asc, desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, documents, events, interests, ndas, passes, users } from "@/db/schema";
import { DESK_BAR } from "@/lib/score";

export type Gap = { what: string; level: "must" | "should" };
export type BookDeal = Awaited<ReturnType<typeof loadBook>>["deals"][number];

const blank = (v: unknown) => v == null || (typeof v === "string" && (!v.trim() || /^(tbc|to be confirmed|—|-|n\/a)$/i.test(v.trim())));

/** What a deal is missing, most important first. A listed deal is judged only on what After the Bell needs. */
export function gapsFor(d: typeof deals.$inferSelect, x: { deck: boolean; docs: number; owner: boolean }): Gap[] {
  const g: Gap[] = [];
  const must = (c: boolean, what: string) => { if (c) g.push({ what, level: "must" }); };
  const should = (c: boolean, what: string) => { if (c) g.push({ what, level: "should" }); };
  const r = d.room ?? ({} as typeof d.room);
  if (d.listed) {
    const li = d.listedInfo ?? {};
    must(blank(li.ticker), "Ticker / exchange");
    should(blank(li.dealType), "Deal type (block, QIP, preferential …)");
    should(li.sizeCr == null, "Deal size");
    should(!x.owner, "Desk owner");
    return g;
  }
  must(blank(d.roundLabel) && d.roundCr == null, "Round size");
  must(blank(d.preMoney), "Pre-money valuation");
  must(blank(d.minTicket), "Minimum ticket");
  must(d.score == null, "Desk Score");
  if (d.score != null) must(d.score < DESK_BAR, `Desk Score below ${DESK_BAR.toFixed(1)}`);
  must(blank(d.listingMonth) || blank(d.listingLabel), "Target listing date");
  must(!x.deck, "Pitch deck for approved investors");
  must(blank(r.why), "Why it is on the desk");
  must(!r.fin?.rows?.length, "Financials table");
  should(blank(d.peLabel), "P/E at the round");
  should(blank(d.headline), "Public one-liner");
  should(blank(r.lede), "Room lede");
  should(!r.founders?.length, "Promoters / management");
  should((r.snapshot ?? []).length < 4, "Snapshot (4+ figures)");
  should((r.risks ?? []).length < 3, "Risks (3+)");
  should(!(r.terms ?? []).length, "Round terms");
  should(!(r.path ?? []).length, "Road to listing");
  should(!(r.checks ?? []).length, "Diligence checks");
  should(!r.compare, "Listed-peer comparison");
  should(blank(d.dataRoomUrl), "Data room link");
  should(x.docs < 3, "Room documents (3+)");
  should(!x.owner, "Desk owner");
  should(blank(d.asOf), "Figures 'as of' date");
  should(blank(d.art), "Card illustration");
  return g;
}

export async function loadBook() {
  const db = await getDb();
  const rows = await db.select().from(deals).orderBy(asc(deals.listed), asc(deals.sort), desc(deals.updatedAt));
  const ids = rows.map((d) => d.id);
  if (!ids.length) return { deals: [], at: new Date() };
  const cnt = sql<number>`count(*)::int`;
  const [docRows, ndaRows, intRows, passRows, viewRows, owners] = await Promise.all([
    db.select({ dealId: documents.dealId, audience: documents.audience, title: documents.title, status: documents.status }).from(documents).where(inArray(documents.dealId, ids)),
    db.select({ dealId: ndas.dealId, n: cnt }).from(ndas).where(inArray(ndas.dealId, ids)).groupBy(ndas.dealId),
    db.select({ dealId: interests.dealId, n: cnt, cr: sql<number>`coalesce(sum(case when ${interests.status} <> 'Withdrawn' then ${interests.amountCr}::numeric else 0 end),0)::float` })
      .from(interests).where(inArray(interests.dealId, ids)).groupBy(interests.dealId),
    db.select({ dealId: passes.dealId, n: cnt }).from(passes).where(inArray(passes.dealId, ids)).groupBy(passes.dealId),
    db.select({ dealId: events.dealId, n: sql<number>`count(distinct ${events.officeId})::int` }).from(events)
      .where(sql`${events.dealId} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)}) and ${events.officeId} is not null`).groupBy(events.dealId),
    db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.role} in ('admin','analyst')`),
  ]);
  const by = <T extends { dealId: number | null }>(xs: T[]) => new Map(xs.map((x) => [x.dealId as number, x]));
  const nd = by(ndaRows), it = by(intRows), ps = by(passRows), vw = by(viewRows);
  const who = new Map(owners.map((u) => [u.id, u.name]));
  return {
    at: new Date(),
    deals: rows.map((d) => {
      const docs = docRows.filter((x) => x.dealId === d.id && x.status !== "proposed");
      const deck = docs.some((x) => x.audience === "approved");
      const owner = d.ownerId ? who.get(d.ownerId) ?? null : null;
      const gaps = gapsFor(d, { deck, docs: docs.length, owner: !!owner });
      const checks = d.listed ? 4 : 23; // the number of checks gapsFor runs for each kind
      return {
        d, owner, docs, deck,
        ndas: nd.get(d.id)?.n ?? 0, requests: it.get(d.id)?.n ?? 0, requestedCr: it.get(d.id)?.cr ?? 0,
        passes: ps.get(d.id)?.n ?? 0, offices: vw.get(d.id)?.n ?? 0,
        gaps, complete: Math.max(0, Math.round((100 * (checks - gaps.length)) / checks)),
      };
    }),
  };
}
