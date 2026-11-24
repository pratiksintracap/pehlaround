// Interest in a deal as the desk hears it (phone, WhatsApp, email, meetings, the portal). Desk only. Shared by the deal
// workspace, the deal pipeline, its export, the assistant and the day report. Writes: lib/deal-interest-actions.ts. (lib/interest.ts is the investor-side engagement score, a different thing.)
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealInterest } from "@/db/schema";

export const INTEREST_STATUS = [
  { id: "pitched", label: "Pitched" },
  { id: "interested", label: "Interested" },
  { id: "meeting", label: "Call / meeting" },
  { id: "soft", label: "Soft commit" },
  { id: "committed", label: "Committed" },
  { id: "passed", label: "Passed" },
] as const;
export type InterestStatus = (typeof INTEREST_STATUS)[number]["id"];
export const interestLabel = (id: string) => INTEREST_STATUS.find((x) => x.id === id)?.label ?? id;
export const isInterestStatus = (v: unknown): v is InterestStatus => INTEREST_STATUS.some((x) => x.id === v);
export const CHANNELS = ["phone", "whatsapp", "email", "meeting", "portal", "other"] as const;
export const channelLabel = (c: string | null) => ({ phone: "Phone", whatsapp: "WhatsApp", email: "Email", meeting: "Meeting", portal: "Portal", other: "Other" } as Record<string, string>)[c ?? ""] ?? "";
/** Interested or further along, and not passed. */
export const isWarm = (st: string) => ["interested", "meeting", "soft", "committed"].includes(st);
export type Interest = typeof dealInterest.$inferSelect;
const RANK: Record<string, number> = { committed: 0, soft: 1, meeting: 2, interested: 3, pitched: 4, passed: 5 };
export const sortInterest = (l: Interest[]) => [...l].sort((a, b) => (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || +b.updatedAt - +a.updatedAt);

export async function interestFor(dealIds: number[]) {
  if (!dealIds.length) return new Map<number, Interest[]>();
  const db = await getDb();
  const rows = await db.select().from(dealInterest).where(inArray(dealInterest.dealId, dealIds)).orderBy(asc(dealInterest.id));
  const m = new Map<number, Interest[]>();
  for (const r of rows) m.set(r.dealId, [...(m.get(r.dealId) ?? []), r]);
  for (const [k, v] of m) m.set(k, sortInterest(v));
  return m;
}
export async function interestOn(dealId: number) { return (await interestFor([dealId])).get(dealId) ?? []; }
export async function interestRow(id: number) { const db = await getDb(); return (await db.select().from(dealInterest).where(eq(dealInterest.id, id)))[0] ?? null; }

/** One line for lists: "3 interested · ₹4.5 Cr soft or committed · 2 pitched · 1 passed". */
export function interestSummary(l: Interest[]) {
  const warm = l.filter((x) => isWarm(x.status)), pitched = l.filter((x) => x.status === "pitched").length, passed = l.filter((x) => x.status === "passed").length;
  const firm = l.filter((x) => x.status === "soft" || x.status === "committed").reduce((a, x) => a + (x.amountCr ?? 0), 0);
  return [warm.length ? `${warm.length} interested` : "", firm ? `₹${+firm.toFixed(2)} Cr soft or committed` : "", pitched ? `${pitched} pitched` : "", passed ? `${passed} passed` : ""].filter(Boolean).join(" · ");
}
export const who = (x: Pick<Interest, "name" | "firm">) => (x.firm && x.firm.toLowerCase() !== x.name.toLowerCase() ? `${x.name} (${x.firm})` : x.name);
