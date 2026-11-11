"use server";
import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deals, deskInvites, leads, offices, partnerTargets, users } from "@/db/schema";
import { requireAdmin, requirePerm, log } from "@/lib/auth";
import { done, fail, str } from "@/lib/form";
import { investorWhere } from "@/lib/deal-guard";
import { notifyOffices } from "@/lib/notify";

// The desk's side of the partner programme: invite a firm as a partner, and set what it is asked to bring to an issue.

const HERE = "/admin/partners";
const EM = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite a firm as a partner (from a partner application, or by hand). It registers approved, as a broker / wealth
 *  manager. No email goes out: the desk sends the link itself, with the partner agreement. */
export async function invitePartner(f: FormData) {
  const admin = await requireAdmin();
  const email = str(f, "email", 200).toLowerCase(), name = str(f, "name", 120), firm = str(f, "firm", 160), leadId = Number(f.get("leadId")) || null;
  if (!EM.test(email) || !firm) fail(`${HERE}#apply`, "A firm name and an email are needed.");
  const db = await getDb();
  const [used] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (used) fail(`${HERE}#apply`, `${email} is already registered. Set that office's type to Broker / wealth manager under Family offices.`);
  const [dup] = await db.select({ id: deskInvites.id }).from(deskInvites).where(and(eq(deskInvites.email, email), isNull(deskInvites.usedAt)));
  if (dup) fail(`${HERE}#apply`, `${email} already has an invitation waiting (Invite offices).`);
  const token = randomBytes(18).toString("base64url");
  await db.insert(deskInvites).values({ token, email, name: name || null, officeName: firm, createdBy: admin.name, known: true, investorType: "broker" });
  if (leadId) await db.update(leads).set({ status: "Contacted" }).where(and(eq(leads.id, leadId), eq(leads.kind, "partner")));
  await log(admin, `Desk invited ${firm} as a partner`, null, { entity: "office", detail: { note: email } });
  done(`${HERE}#invited`, `${firm} invited as a partner. Its link is below: send it yourself, with the partner agreement.`);
}

/** What the desk asks of a partner firm for one issue. Leaving both numbers empty clears the target. */
export async function savePartnerTarget(f: FormData) {
  const me = await requirePerm("workflow");
  const officeId = Number(f.get("officeId")), dealId = Number(f.get("dealId"));
  let leg = str(f, "leg", 10) === "ipo" ? "ipo" : "pre_ipo";
  const back = `${HERE}#p${officeId}`;
  const pos = (k: string) => { const v = parseFloat(str(f, k, 20).replace(/,/g, "")); return isFinite(v) && v > 0 ? v : null; };
  const intros = pos("intros") ? Math.round(pos("intros")!) : null, amountCr = pos("amountCr"), note = str(f, "note", 300) || null;
  const db = await getDb();
  const [o] = await db.select({ id: offices.id, name: offices.name, investorType: offices.investorType }).from(offices).where(eq(offices.id, officeId));
  if (!o || o.investorType !== "broker") fail(HERE, "That office is not a partner firm.");
  const [d] = await db.select({ id: deals.id, company: deals.company, ipoOnly: deals.ipoOnly }).from(deals).where(investorWhere(eq(deals.id, dealId)));
  if (!d) fail(back, "Choose an issue.");
  if (d!.ipoOnly) leg = "ipo"; // an IPO-only issue has no round on the desk
  const where = and(eq(partnerTargets.officeId, officeId), eq(partnerTargets.dealId, dealId), eq(partnerTargets.leg, leg));
  const [prev] = await db.select().from(partnerTargets).where(where);
  if (!intros && !amountCr) {
    if (prev) await db.delete(partnerTargets).where(eq(partnerTargets.id, prev.id));
    await log(me, `Desk cleared ${o!.name}'s target for ${d!.company}`, dealId, { entity: "office", entityId: officeId });
    done(back, "Target cleared.");
  }
  if (prev) await db.update(partnerTargets).set({ intros, amountCr, note, setBy: me.name, updatedAt: new Date() }).where(eq(partnerTargets.id, prev.id));
  else await db.insert(partnerTargets).values({ officeId, dealId, leg, intros, amountCr, note, setBy: me.name });
  const what = [intros ? `${intros} ${leg === "ipo" ? "clients" : "introductions"}` : "", amountCr ? `₹${amountCr} Cr` : ""].filter(Boolean).join(" and ");
  await log(me, `Desk set ${o!.name}'s target for ${d!.company}${leg === "ipo" ? " (IPO)" : ""}: ${what}`, dealId, { entity: "office", entityId: officeId });
  if (f.get("tell") === "on") await notifyOffices([officeId], { title: `${d!.company}: your firm's target is ${what}`, body: note, link: "/dashboard/partner" });
  done(back, "Target saved.");
}
