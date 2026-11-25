"use server";
// Adding, editing and removing who is interested in a deal (lib/deal-interest.ts). Desk only; every change goes to the trail
// with the fields that changed, so it shows on the deal's activity and in the day report.
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { dealInterest } from "@/db/schema";
import { requirePerm, log, changes } from "@/lib/auth";
import { can } from "@/lib/perm";
import { deskDeal } from "@/lib/desk";
import { istDay } from "@/lib/stages";
import { done, fail, deskBack } from "@/lib/form";
import { CHANNELS, interestLabel, interestRow, isInterestStatus } from "@/lib/deal-interest";

const s = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);

export async function saveInterest(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const id = Number(f.get("id")) || 0, dealId = Number(f.get("dealId")) || 0;
  const fallback = `/admin/deals/${dealId}#desk-interest`;
  const backTo = (msg: string): never => done(deskBack(f, fallback), msg);
  const refuse = (msg: string): never => fail(deskBack(f, fallback), msg);
  if (f.get("delete") === "on") {
    if (!can(me, "delete")) return refuse("Only a super admin can remove an entry. Mark it Passed instead.");
    const prev = await interestRow(id);
    if (!prev) return refuse("Entry not found.");
    await db.delete(dealInterest).where(eq(dealInterest.id, id));
    await log(me, `Desk removed ${prev.name} from the interest list`, prev.dealId, { entity: "interest", entityId: id });
    return backTo("Removed.");
  }
  const name = s(f, "name", 160);
  if (!name) return refuse("Give a name.");
  const status = isInterestStatus(f.get("status")) ? String(f.get("status")) : "pitched";
  const chan = String(f.get("channel") || "");
  const amt = parseFloat(s(f, "amountCr", 20).replace(/[₹,\s]/g, ""));
  const lastOn = /^\d{4}-\d{2}-\d{2}$/.test(s(f, "lastOn", 10)) ? s(f, "lastOn", 10) : istDay();
  const vals = { name, firm: s(f, "firm", 160) || null, contact: s(f, "contact", 160) || null, channel: (CHANNELS as readonly string[]).includes(chan) ? chan : null,
    status, amountCr: isFinite(amt) && amt > 0 ? amt : null, note: s(f, "note", 2000) || null, lastOn };
  if (id) {
    const prev = await interestRow(id);
    if (!prev) return refuse("Entry not found.");
    await db.update(dealInterest).set({ ...vals, updatedAt: new Date() }).where(eq(dealInterest.id, id));
    const what = prev.status !== status ? `${name}: ${interestLabel(prev.status)} → ${interestLabel(status)}` : `${name} updated`;
    await log(me, `Desk interest · ${what}`, prev.dealId, { entity: "interest", entityId: id, detail: { changes: changes(prev, vals, ["name", "firm", "status", "amountCr", "channel", "note"]) } });
    return backTo("Saved.");
  }
  if (!dealId || !(await deskDeal(dealId))) return refuse("Deal not found.");
  const [row] = await db.insert(dealInterest).values({ dealId, ...vals, createdBy: me.name }).returning({ id: dealInterest.id });
  await log(me, `Desk interest · ${name}: ${interestLabel(status)}${vals.amountCr ? ` (₹${vals.amountCr} Cr)` : ""}`, dealId, { entity: "interest", entityId: row.id });
  return backTo(`Added ${name}.`);
}

/** From "Who to pitch": puts a registered investor on the deal's interest list as Pitched, linked to its office. */
export async function addMatchToInterest(f: FormData) {
  const me = await requirePerm("workflow");
  const db = await getDb();
  const dealId = Number(f.get("dealId")) || 0, officeId = Number(f.get("officeId")) || 0;
  const fallback = `/admin/deals/${dealId}#desk-interest`;
  if (!dealId || !officeId || !(await deskDeal(dealId))) return fail(deskBack(f, fallback), "Deal or investor not found.");
  const { offices, users } = await import("@/db/schema");
  const { and } = await import("drizzle-orm");
  const [o] = await db.select().from(offices).where(eq(offices.id, officeId));
  if (!o) return fail(deskBack(f, fallback), "Investor not found.");
  const [dup] = await db.select({ id: dealInterest.id }).from(dealInterest).where(and(eq(dealInterest.dealId, dealId), eq(dealInterest.officeId, officeId)));
  if (dup) return done(deskBack(f, fallback), `${o.name} is already on the interest list.`);
  const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(and(eq(users.officeId, officeId), eq(users.disabled, false)));
  const [row] = await db.insert(dealInterest).values({ dealId, officeId, name: o.name, firm: null, contact: u?.email ?? o.contactEmail ?? null,
    status: "pitched", note: u?.name || o.contactName ? `Contact: ${u?.name ?? o.contactName}` : null, lastOn: istDay(), createdBy: me.name }).returning({ id: dealInterest.id });
  await log(me, `Desk interest · ${o.name}: Pitched (from Who to pitch)`, dealId, { entity: "interest", entityId: row.id });
  return done(deskBack(f, fallback), `${o.name} added as Pitched. Update the status as the conversation moves.`);
}
