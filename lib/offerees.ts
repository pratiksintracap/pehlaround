import "server-only";
import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ndas, offices } from "@/db/schema";
import { finYear, isQib, OFFEREE_LIMIT, OFFEREE_WARN } from "@/lib/investor";

/** Offerees per deal this financial year: distinct offices that signed the company's NDA (and so were shown its room)
 *  since 1 April, leaving out SEBI-registered AIFs, which the Companies Act's 200-person limit does not count.
 *  Revoked NDAs still count: the offer was made. */
export async function offereeCounts() {
  const db = await getDb();
  const fy = finYear();
  const rows = await db.select({ dealId: ndas.dealId, officeId: ndas.officeId, investorType: offices.investorType, category: offices.category })
    .from(ndas).innerJoin(offices, eq(offices.id, ndas.officeId)).where(and(gte(ndas.signedAt, fy.start)));
  const m = new Map<number, Set<number>>();
  for (const r of rows) { if (isQib(r)) continue; if (!m.has(r.dealId)) m.set(r.dealId, new Set()); m.get(r.dealId)!.add(r.officeId); }
  return { fy: fy.label, counts: new Map([...m].map(([k, v]) => [k, v.size])) };
}
export const offereeLevel = (n: number) => (n >= OFFEREE_LIMIT ? "over" : n >= OFFEREE_WARN ? "near" : "ok");
