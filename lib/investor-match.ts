import "server-only";
// Who to pitch a deal to: every registered (or desk-added) investor office scored against one deal, from what the office
// told us (sectors, ticket, structures) and what it has done on the platform (views, saves, NDAs, allocation requests,
// passes). Desk only. Used by the deal workspace ("Who to pitch") and the assistant (relay action "match").
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealInterest, dealPrefs, dealViews, interests, ndas, offices, passes, users } from "@/db/schema";
import { SECTORS } from "@/lib/profile";

type DealLike = { id: number; title: string; category: string; headline?: string | null; roundCr?: string | number | null; listed?: boolean; debt?: boolean; room?: { interest?: { min?: number } } | null };
export type Match = {
  officeId: number; name: string; type: string; city: string | null; ticket: string | null; approval: string; score: number;
  reasons: string[]; flags: string[]; contact: { name: string | null; email: string | null }; inRoom: boolean; onList: boolean;
};

// The top of each ticket band, in ₹ crore.
const TICKET_TOP: Record<string, number> = { "Under ₹50 lakh": 0.5, "₹50 lakh – 1 crore": 1, "₹1–2 crore": 2, "₹2–5 crore": 5, "₹5–25 crore": 25, "Above ₹25 crore": 100 };
const TYPE: Record<string, string> = { family_office: "Family office", fund: "Fund", individual: "Individual", broker: "Partner" };

/** The sector labels a deal belongs to, from its anonymised title, category and headline (never the company name). */
export function dealSectors(d: Pick<DealLike, "title" | "category" | "headline">) {
  const text = `${d.title} ${d.category} ${d.headline || ""}`;
  return SECTORS.filter(([, re]) => re.test(text)).map(([n]) => n);
}

export async function matchInvestors(d: DealLike, limit = 12): Promise<Match[]> {
  if (d.debt) return [];                                   // debt goes to lenders, not to investor offices
  const db = await getDb();
  const all = await db.select().from(offices).where(and(ne(offices.approval, "rejected"), ne(offices.investorType, "broker")));
  if (!all.length) return [];
  const ids = all.map((o) => o.id);
  const [people, ndaAll, intAll, passAll, views, saves, onList] = await Promise.all([
    db.select({ officeId: users.officeId, name: users.name, email: users.email }).from(users).where(and(inArray(users.officeId, ids), eq(users.disabled, false))),
    db.select({ officeId: ndas.officeId, dealId: ndas.dealId }).from(ndas).where(inArray(ndas.officeId, ids)),
    db.select({ officeId: interests.officeId, dealId: interests.dealId, status: interests.status }).from(interests).where(inArray(interests.officeId, ids)),
    db.select({ officeId: passes.officeId, dealId: passes.dealId, reason: passes.reason }).from(passes).where(inArray(passes.officeId, ids)),
    db.select({ officeId: dealViews.officeId, n: sql<number>`count(*)::int` }).from(dealViews).where(eq(dealViews.dealId, d.id)).groupBy(dealViews.officeId),
    db.select({ officeId: dealPrefs.officeId }).from(dealPrefs).where(and(eq(dealPrefs.dealId, d.id), eq(dealPrefs.saved, true))),
    db.select({ officeId: dealInterest.officeId, name: dealInterest.name }).from(dealInterest).where(eq(dealInterest.dealId, d.id)),
  ]);
  const secs = dealSectors(d);
  const cat = d.category.toLowerCase();
  const round = Number(d.roundCr) || null;
  const minTicket = Number(d.room?.interest?.min) || null;
  const viewsBy = new Map(views.map((v) => [v.officeId, Number(v.n)]));
  const saved = new Set(saves.map((x) => x.officeId));
  const listed = new Set(onList.map((x) => x.officeId).filter(Boolean));
  const listedNames = new Set(onList.map((x) => x.name.toLowerCase()));

  const out: Match[] = [];
  for (const o of all) {
    const passedThis = passAll.find((p) => p.officeId === o.id && p.dealId === d.id);
    if (passedThis) continue;                              // they said no to this one
    const reasons: string[] = [], flags: string[] = [];
    let score = 0;
    // What the office told us.
    const own = (o.sectors ?? []);
    const hit = own.filter((x) => secs.includes(x));
    if (hit.length) { score += 30; reasons.push(`Invests in ${hit.join(", ").toLowerCase()}`); }
    else if (!own.length) { score += 8; }
    else if (secs.length) { score -= 10; flags.push(`Sectors on file: ${own.slice(0, 3).join(", ").toLowerCase()}`); }
    const st = (o.structures ?? []).find((x) => cat.includes(x.toLowerCase().replace("pre-ipo ", "")) || (x === "Growth round" && cat.includes("growth")));
    if (st) { score += 10; reasons.push(`Does ${st.toLowerCase().replace("pre-ipo", "pre-IPO")} deals`); }
    const top = o.ticket ? TICKET_TOP[o.ticket] : undefined;
    if (top !== undefined) {
      if (minTicket && top < minTicket) { score -= 15; flags.push(`Ticket (${o.ticket}) is below this round's minimum`); }
      else if (round && top >= round * 0.03) { score += 15; reasons.push(`Ticket ${o.ticket} suits a ₹${round} Cr round`); }
      else { score += 5; }
    }
    // What the office has done.
    const v = viewsBy.get(o.id) ?? 0;
    if (v) { score += Math.min(20, 8 + v * 3); reasons.push(`Viewed this deal ${v}×`); }
    if (saved.has(o.id)) { score += 15; reasons.push("Saved this deal"); }
    const inRoom = ndaAll.some((n) => n.officeId === o.id && n.dealId === d.id);
    if (inRoom) { score += 20; reasons.push("Signed this deal's NDA"); }
    const otherNdas = new Set(ndaAll.filter((n) => n.officeId === o.id && n.dealId !== d.id).map((n) => n.dealId)).size;
    if (otherNdas) { score += Math.min(15, otherNdas * 5); reasons.push(`Signed NDAs on ${otherNdas} other deal${otherNdas === 1 ? "" : "s"}`); }
    const alloc = intAll.filter((i) => i.officeId === o.id && i.status !== "Withdrawn");
    if (alloc.some((i) => i.dealId === d.id)) { score += 25; reasons.push("Has requested an allocation here"); }
    else if (alloc.length) { score += 15; reasons.push(`Requested allocations on ${alloc.length} other deal${alloc.length === 1 ? "" : "s"}`); }
    const otherPasses = passAll.filter((p) => p.officeId === o.id).length;
    if (otherPasses >= 2 && !alloc.length) { score -= 5; flags.push(`Passed on ${otherPasses} deals`); }
    if (o.approval === "approved") score += 10; else flags.push("Not approved yet");
    if (o.coLead) { score += 5; reasons.push("Open to co-leading"); }
    const onListNow = (o.id && listed.has(o.id)) || listedNames.has(o.name.toLowerCase());
    if (!reasons.length || (score <= 5 && !inRoom)) continue;      // nothing ties them to this deal yet
    const person = people.find((p) => p.officeId === o.id);
    out.push({ officeId: o.id, name: o.name, type: TYPE[o.investorType] ?? o.investorType, city: o.city, ticket: o.ticket, approval: o.approval, score: Math.max(0, Math.min(100, score)),
      reasons, flags, contact: { name: person?.name ?? o.contactName ?? null, email: person?.email ?? o.contactEmail ?? null }, inRoom, onList: onListNow });
  }
  return out.sort((a, b) => Number(a.onList) - Number(b.onList) || b.score - a.score).slice(0, limit);
}
