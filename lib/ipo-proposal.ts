import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ipoBids, offices, users } from "@/db/schema";
import { log } from "@/lib/auth";
import { notifyDesk, notifyOffices } from "@/lib/notify";
import { track } from "@/lib/track";
import { listDeals } from "@/lib/deals";
import { AWAITING, IPO_CATEGORY, fmtAmount, ipoStage, type IpoCategory } from "@/lib/ipo";

/* IPO interest a partner's relationship manager entered for a client (MODEL.md §6, IPO leg). It is the client's
   decision: the row waits as "Awaiting client" and counts nowhere until the client confirms it, signed in or from the
   personal link it was sent. Declining withdraws it. Either way the partner firm and the desk are told. */

export async function proposalByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) return null;
  const db = await getDb();
  const [b] = await db.select().from(ipoBids).where(and(eq(ipoBids.confirmToken, token), eq(ipoBids.status, AWAITING)));
  return b ?? null;
}

/** Who entered it, for showing to the client: the person and their firm. */
export async function proposer(b: { proposedByUserId: number | null; proposedByOfficeId: number | null }) {
  const db = await getDb();
  const [u] = b.proposedByUserId ? await db.select({ name: users.name }).from(users).where(eq(users.id, b.proposedByUserId)) : [];
  const [o] = b.proposedByOfficeId ? await db.select({ name: offices.name }).from(offices).where(eq(offices.id, b.proposedByOfficeId)) : [];
  return { person: u?.name ?? "Your adviser", firm: o?.name ?? "your adviser's firm" };
}

/** The client's answer. `by` is the signed-in person, or null when it came through the emailed link. */
export async function answerProposal(bidId: number, accept: boolean, by: { id: number; name: string; officeId: number | null } | null): Promise<{ ok: boolean; msg: string }> {
  const db = await getDb();
  const [b] = await db.select().from(ipoBids).where(eq(ipoBids.id, bidId));
  if (!b || b.status !== AWAITING) return { ok: false, msg: "This has already been answered." };
  if (by && by.officeId !== b.officeId) return { ok: false, msg: "This is not your office's to answer." };
  const deal = (await listDeals(true)).find((x) => x.id === b.dealId);
  if (!deal) return { ok: false, msg: "That issue is no longer on the desk." };
  if (accept && ipoStage(deal.ipo) !== "open") return { ok: false, msg: "This issue has closed, so interest can no longer be registered." };
  const [o] = await db.select({ name: offices.name }).from(offices).where(eq(offices.id, b.officeId));
  const who = by?.name ?? "by the link sent to the office";
  await db.update(ipoBids).set({ status: accept ? "Indicated" : "Withdrawn", confirmToken: null, confirmedAt: accept ? new Date() : null, updatedAt: new Date(), ...(by ? { userId: by.id } : {}) }).where(eq(ipoBids.id, b.id));
  const amt = fmtAmount(b.amountCr), cat = IPO_CATEGORY[b.category as IpoCategory]?.label ?? b.category;
  await log(by ?? { id: b.userId, name: `${o?.name ?? "The office"} (emailed link)`, officeId: b.officeId }, `${accept ? "Confirmed" : "Declined"} IPO interest of ${amt} entered by its partner firm: ${deal.company}`, deal.id);
  if (accept) await track("ipo_interest", { officeId: b.officeId, userId: by?.id ?? b.userId, dealId: deal.id, meta: { amountCr: Number(b.amountCr), category: b.category, viaPartner: true } });
  if (b.proposedByOfficeId) await notifyOffices([b.proposedByOfficeId], { title: `${o?.name ?? "Your client"} ${accept ? "confirmed" : "declined"} the IPO interest you entered: ${deal.company}`, body: `${amt} as ${cat.toLowerCase()}.`, link: "/dashboard/partner" });
  await notifyDesk({ title: accept ? `IPO interest confirmed: ${amt} in ${deal.company}` : `IPO interest declined by the client: ${deal.company}`, body: `${o?.name} · ${cat} · entered by its partner firm, ${accept ? "confirmed" : "declined"} ${who}`, link: "/admin/ipo" });
  return { ok: true, msg: accept ? `Confirmed: your interest in ${deal.company}'s IPO is registered. Remember to apply through your broker before the issue closes.` : `Declined. Nothing is registered for ${deal.company}'s IPO.` };
}
