import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { cachedPublic } from "@/lib/cache";
import { deals, ndas } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isDesk } from "@/lib/perm";

export type Deal = typeof deals.$inferSelect;

const allDeals = cachedPublic(async () => { const db = await getDb(); return db.select().from(deals).orderBy(asc(deals.sort), asc(deals.id)); }, "deals");
export async function listDeals(includeUnpublished = false) {
  const rows = await allDeals();
  return includeUnpublished ? rows : rows.filter((d) => d.published);
}

export async function getDeal(slug: string) {
  return (await allDeals()).find((d) => d.slug === slug) ?? null;
}

export async function signedDealIds(officeId: number | null | undefined) {
  if (!officeId) return new Set<number>();
  const db = await getDb();
  const rows = await db.select({ dealId: ndas.dealId }).from(ndas).where(and(eq(ndas.officeId, officeId), isNull(ndas.revokedAt)));
  return new Set(rows.map((r) => r.dealId));
}

export type Access =
  | { state: "anon" }                 // not signed in
  | { state: "no-office" }            // signed in without an office (should not happen for members)
  | { state: "blocked" }              // office rejected by the desk
  | { state: "pending-approval" }     // registered, waiting for the desk to approve the office
  | { state: "closed" }               // the deal's room is not open
  | { state: "need-nda" }             // registered, NDA with this company not yet signed
  | { state: "pending-pan" }          // NDA signed, desk still verifying PAN (only when REQUIRE_PAN_VERIFIED=1)
  | { state: "open"; admin?: boolean };

export async function roomAccess(user: SessionUser | null, deal: Deal): Promise<Access> {
  if (!user) return { state: "anon" };
  if (isDesk(user)) return { state: "open", admin: true };
  if (!user.office) return { state: "no-office" };
  const st = await getSettings();
  if (user.office.status === "rejected" || user.office.approval === "rejected") return { state: "blocked" };
  if (st.requireApproval && user.office.approval !== "approved") return { state: "pending-approval" };
  if (!deal.open) return { state: "closed" };
  const signed = await signedDealIds(user.office.id);
  if (!signed.has(deal.id)) return { state: "need-nda" };
  return { state: "open" };
}

export function trackerCounts(d: Deal) {
  const c = { done: 0, "in-progress": 0, pending: 0 };
  for (const k of d.room.checks) c[k.status]++;
  return { done: c.done, prog: c["in-progress"], pend: c.pending, total: d.room.checks.length };
}

/** What ud.js needs for the shortlist and compare (public, anonymised fields only). */
export function publicData(list: Deal[]) {
  return list.map((d) => ({ slug: d.slug, sector: d.title, category: d.category,
    listing: d.listingMonth ? `${d.listingLabel} (target)` : d.listingLabel, status: d.status }));
}

/** Whether this visitor sees company names and round terms (registered and, if required, approved). */
export async function canSeeNames(user: SessionUser | null) {
  if (!user) return false;
  if (isDesk(user)) return true;
  if (!user.office || user.office.approval === "rejected") return false;
  const st = await getSettings();
  return !st.requireApproval || user.office.approval === "approved";
}

type DocLike = { audience: string; officeIds: number[] | null };
/** Whether this office sees a document's link: "yes", "after-allocation" (listed, opens once they request an allocation) or "no" (not listed). */
export function docAccess(doc: DocLike, officeId: number | null | undefined, requestedAllocation: boolean, isAdmin = false): "yes" | "after-allocation" | "no" {
  if (isAdmin) return "yes";
  if (doc.audience === "offices") return officeId && (doc.officeIds || []).includes(officeId) ? "yes" : "no";
  if (doc.audience === "allocation") return requestedAllocation ? "yes" : "after-allocation";
  return "yes";
}
